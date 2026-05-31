import type { Graph } from '../../schemas/primitives'
import {
  findLatestEntry,
  isSendKind,
  pickRoutedEdgeFromSource,
  visitedNodeIds,
  type RunHistoryEntry
} from './helpers'
import { runDayAtNode } from './run-day'
import { hasExitedNode } from './actionable'

/**
 * Has this node finished routing — for *frontier-gating purposes*?
 *   - `end`: never exits (terminus).
 *   - `start`: exits as soon as it's visited (no outcome to observe).
 *   - `send_*`: exits when its outcome is recorded (new convention) OR when
 *     an outgoing target was added to history after it (old convention).
 *
 * Distinct from `hasExitedNode` which is the *action-availability* check —
 * `hasExitedNode` is more conservative for Start (position-aware) so the
 * very first `advance(start)` tick is still a valid `leave`.
 */
function isExitedForGating(
  graph: Graph,
  history: RunHistoryEntry[],
  nodeId: string
): boolean {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node) return false
  if (node.data.kind === 'end') return false
  if (node.data.kind === 'start') return history.some(h => h.nodeId === nodeId)
  if (isSendKind(node.data.kind)) {
    const entry = findLatestEntry(history, nodeId)
    if (entry?.outcome !== undefined) return true
    return hasExitedNode(graph, history, nodeId)
  }
  return false
}

/**
 * Set of nodes the run can still reach given the routing decisions recorded so
 * far. Forward BFS from the visited set:
 *   - an **exited** node only keeps its *routed* outgoing edge live (the branch
 *     it actually took); the other branches are dead.
 *   - a visited-but-not-yet-exited node, or a not-yet-visited reachable node,
 *     keeps *all* its outgoing edges live (its outcome — hence its branch — is
 *     not decided yet).
 *
 * Used by `computeActiveFrontiers` to tell a genuinely-pending predecessor
 * (might still fire into the target) apart from a dead one (its source took a
 * different branch, so it can never fire). Without this, the failure target of
 * a send that succeeded — or any node on a not-taken branch — was treated as
 * "ready" the moment its source exited, computed `runDayAtNode = 0` (its
 * incoming edge was never routed) and, being day 0, won the chrono open-day
 * race and snapped focus / the J+N cursor back to the start.
 */
function computeReachableNodes(graph: Graph, history: RunHistoryEntry[]): Set<string> {
  const visited = visitedNodeIds(history)
  const reachable = new Set<string>(visited)
  const queue: string[] = [...visited]

  while (queue.length > 0) {
    const id = queue.shift()!
    const exited = isExitedForGating(graph, history, id)
    for (const e of graph.edges.filter(edge => edge.source === id)) {
      let live: boolean
      if (exited) {
        const srcEntry = findLatestEntry(history, id)
        const routed = srcEntry ? pickRoutedEdgeFromSource(graph, history, srcEntry, e.target) : null
        live = routed?.id === e.id
      } else {
        // Outcome not decided yet → every outgoing branch is still possible.
        live = true
      }
      if (live && !reachable.has(e.target)) {
        reachable.add(e.target)
        queue.push(e.target)
      }
    }
  }
  return reachable
}

/**
 * Nodes that may be entered next, and whose **runtime** entry day equals the
 * minimum across all ready nodes (strict temporal gate — finish all of J+N
 * before any J+M with M > N).
 *
 * A node opens when, among its incoming edges:
 *   - at least one is **routed** to it (a reachable predecessor actually fired
 *     through that edge), and
 *   - none is still **pending** (a reachable predecessor whose outcome — hence
 *     whether it routes here — is not decided yet).
 *
 * Edges from **dead** sources (a predecessor that exited and routed elsewhere,
 * or a node that became unreachable) are ignored. This makes parallel joins
 * wait for every live branch, while alternative merges (e.g. several success
 * branches converging on one `end`) open as soon as the single branch that
 * actually fired arrives — and the not-taken failure ends never open at all.
 */
export function computeActiveFrontiers(graph: Graph, history: RunHistoryEntry[]): string[] {
  const visited = visitedNodeIds(history)
  const reachable = computeReachableNodes(graph, history)
  const ready: string[] = []

  for (const n of graph.nodes) {
    if (visited.has(n.id)) continue
    const incoming = graph.edges.filter(e => e.target === n.id)
    if (incoming.length === 0) continue

    let routedCount = 0
    let pending = false
    for (const e of incoming) {
      if (!reachable.has(e.source)) continue // dead branch — ignore
      if (!isExitedForGating(graph, history, e.source)) { pending = true; break }
      const srcEntry = findLatestEntry(history, e.source)
      const routed = srcEntry ? pickRoutedEdgeFromSource(graph, history, srcEntry, n.id) : null
      if (routed?.id === e.id) routedCount++
    }
    if (pending || routedCount === 0) continue
    ready.push(n.id)
  }

  if (ready.length === 0) return []

  const openDay = Math.min(...ready.map(id => runDayAtNode(graph, history, id)))
  return ready
    .filter(id => runDayAtNode(graph, history, id) === openDay)
    .sort()
}
