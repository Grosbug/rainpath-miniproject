import { CHANNEL_FAILURE_STATUSES, type ChannelKey } from '../schemas/channels'
import type { Graph, GraphEdge, GraphNode } from '../schemas/primitives'

export type RunHistoryEntry = { nodeId: string; enteredAt: string; outcome?: string }

/**
 * Layout-day used by the editor canvas — derived from `position.x`. Kept for
 * UI badge alignment ("J+N" pill on the patient cards) but no longer used to
 * gate which frontier is "open now". The runtime gating uses `runDayAtNode`,
 * which follows the patient's actual history.
 */
export function nodeScheduledDay(graph: Graph, nodeId: string): number {
  const n = graph.nodes.find(x => x.id === nodeId)
  if (!n || n.data.kind === 'start') return 0
  return Math.max(0, Math.round(n.position.x))
}

export function visitedNodeIds(history: RunHistoryEntry[]): Set<string> {
  return new Set(history.map(h => h.nodeId))
}

function isSendKind(kind: string): boolean {
  return kind === 'send_email' || kind === 'send_sms' || kind === 'send_whatsapp' || kind === 'send_postal'
}

function channelKeyOf(node: GraphNode): ChannelKey | null {
  const d = node.data
  if (d.kind === 'send_email') return 'email'
  if (d.kind === 'send_sms') return 'sms'
  if (d.kind === 'send_whatsapp') return 'whatsapp'
  if (d.kind === 'send_postal') return d.params.tracked ? 'postal_tracked' : 'postal_untracked'
  return null
}

function findLatestEntry(history: RunHistoryEntry[], nodeId: string): RunHistoryEntry | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.nodeId === nodeId) return history[i]
  }
  return undefined
}

/**
 * Effective outcome a source observed, supporting both history conventions:
 *   - **New** (preferred): outcome attached to the source's own entry.
 *   - **Old** (kept for back-compat with pre-refactor runs): outcome attached
 *     to the entry of the target that came immediately after the source.
 */
function effectiveSourceOutcome(
  graph: Graph,
  history: RunHistoryEntry[],
  source: GraphNode,
  srcEntry: RunHistoryEntry
): string | undefined {
  if (srcEntry.outcome !== undefined) return srcEntry.outcome
  if (!isSendKind(source.data.kind)) return undefined
  const idx = history.indexOf(srcEntry)
  if (idx < 0) return undefined
  const outgoingTargets = new Set(
    graph.edges.filter(e => e.source === source.id).map(e => e.target)
  )
  for (let i = idx + 1; i < history.length; i++) {
    const e = history[i]!
    if (outgoingTargets.has(e.nodeId) && e.outcome !== undefined) return e.outcome
  }
  return undefined
}

/**
 * Identify the specific outgoing edge from `source` that routes to `targetId`
 * given the source's observed outcome. Returns null when no edge matches —
 * e.g. when a send_* hasn't recorded its outcome yet so the routing is not
 * yet decided. Used by `runDayAtNode` to attribute each edge to the source
 * that actually fired through it.
 */
export function pickRoutedEdgeFromSource(
  graph: Graph,
  history: RunHistoryEntry[],
  srcEntry: RunHistoryEntry,
  targetId: string
): GraphEdge | null {
  const source = graph.nodes.find(n => n.id === srcEntry.nodeId)
  if (!source) return null
  const candidates = graph.edges.filter(e => e.source === source.id && e.target === targetId)
  if (candidates.length === 0) return null

  const d = source.data
  if (d.kind === 'start' || d.kind === 'end') {
    return candidates[0] ?? null
  }

  if (isSendKind(d.kind)) {
    const out = d.params.output
    const outcome = effectiveSourceOutcome(graph, history, source, srcEntry)
    if (outcome === undefined) return null

    if (out.mode === 'simple') {
      const ck = channelKeyOf(source)
      const isFailure = !!ck && (CHANNEL_FAILURE_STATUSES[ck] as readonly string[]).includes(outcome)
      const want = isFailure ? 'failure' : 'success'
      return candidates.find(e => e.sourceHandle === want) ?? null
    }
    if (out.mode === 'multi') {
      const match = out.outputs.find(o => o.condition.statuses.includes(outcome))
      if (!match) return null
      return candidates.find(e => e.sourceHandle === match.id) ?? null
    }
  }
  return null
}

/**
 * Cumulative day at which the patient enters / entered `nodeId` along the
 * simulated path. Computed as the max over every routed incoming edge of
 * (`dayAtNode(source)` + `edge.daysAfter`) — only edges the source actually
 * routed through count. For convergent join targets, this correctly takes
 * the max of all branches that fired into it.
 *
 * Use this rather than `nodeScheduledDay` whenever the question is "what day
 * is it in this run?" — `position.x` is layout-only and drifts from the real
 * path as soon as edge.daysAfter or non-default outcomes diverge from the
 * editor's preview.
 */
export function runDayAtNode(graph: Graph, history: RunHistoryEntry[], nodeId: string): number {
  const memo = new Map<string, number>()

  function compute(id: string): number {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    memo.set(id, 0)

    const incoming = graph.edges.filter(e => e.target === id)
    if (incoming.length === 0) {
      memo.set(id, 0)
      return 0
    }

    let day = 0
    for (const e of incoming) {
      const srcEntry = findLatestEntry(history, e.source)
      if (!srcEntry) continue
      const routed = pickRoutedEdgeFromSource(graph, history, srcEntry, id)
      if (!routed || routed.id !== e.id) continue
      const sourceDay = compute(e.source)
      const step = sourceDay + e.daysAfter
      if (step > day) day = step
    }
    memo.set(id, day)
    return day
  }

  return compute(nodeId)
}

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

export type NodeRunAction = 'enter' | 'leave'

/**
 * True when this node has already routed somewhere — either by recording an
 * outcome on its entry (send_* new convention) or by having one of its
 * outgoing targets appear later in history (universal / pre-refactor data).
 *
 * Used by `nodeRunAction` so a node which has already routed does NOT keep
 * showing up as "leave-able" and re-routing on subsequent ticks.
 */
export function hasExitedNode(graph: Graph, history: RunHistoryEntry[], nodeId: string): boolean {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (node && isSendKind(node.data.kind)) {
    const entry = findLatestEntry(history, nodeId)
    if (entry?.outcome !== undefined) return true
  }
  const firstIdx = history.findIndex(h => h.nodeId === nodeId)
  if (firstIdx < 0) return false
  const outgoingTargets = new Set(
    graph.edges.filter(e => e.source === nodeId).map(e => e.target)
  )
  if (outgoingTargets.size === 0) return false
  for (let i = firstIdx + 1; i < history.length; i++) {
    if (outgoingTargets.has(history[i]!.nodeId)) return true
  }
  return false
}

/**
 * Whether `nodeId` can be advanced — either as a frontier (`enter`) or as a
 * visited node still pending its outgoing transition (`leave`). Leave is
 * gated on `hasExitedNode` so that a node which already routed to a target
 * (Start after the first tick, a `send_*` after its outcome was observed)
 * does NOT keep showing up as actionable and re-routing on subsequent ticks.
 */
export function nodeRunAction(
  graph: Graph,
  history: RunHistoryEntry[],
  frontiers: string[],
  nodeId: string
): NodeRunAction | null {
  const visited = visitedNodeIds(history)
  if (frontiers.includes(nodeId)) return 'enter'
  if (!visited.has(nodeId)) return null
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node || node.data.kind === 'end') return null
  if (hasExitedNode(graph, history, nodeId)) return null
  return 'leave'
}

/**
 * Actionable node with the smallest cumulative day in the run. Used to drive
 * the top-bar "Prochain" button: the simulator advances chronologically across
 * branches instead of locking onto whichever card the user happens to view.
 *
 * Tie-breaking when several actionable nodes share the same day:
 *   1. Prefer **leave** over **enter** — when you just opened a card the
 *      "Prochain" tick should stay there so you can record its outcome,
 *      not jump to a same-day sibling and leave you wondering which card
 *      the picker is even controlling.
 *   2. Then alphabetical by id — deterministic, mirrors the existing
 *      `computeActiveFrontiers` sort.
 *
 * Returns `null` when nothing is actionable (run finished, or wedged with no
 * frontier and no open send_*).
 */
export function chronoEarliestActionableNodeId(
  graph: Graph,
  history: RunHistoryEntry[],
  frontiers: string[]
): string | null {
  const visited = visitedNodeIds(history)
  type Candidate = { id: string; day: number; kind: 'enter' | 'leave' }
  const candidates: Candidate[] = []

  for (const id of frontiers) {
    candidates.push({ id, day: runDayAtNode(graph, history, id), kind: 'enter' })
  }
  for (const id of visited) {
    if (nodeRunAction(graph, history, frontiers, id) !== 'leave') continue
    candidates.push({ id, day: runDayAtNode(graph, history, id), kind: 'leave' })
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day
    if (a.kind !== b.kind) return a.kind === 'leave' ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return candidates[0]!.id
}

/**
 * Pick a valid focus id. The stored preference wins when it's still actionable
 * (= the user's manual "drive that branch instead" override). Otherwise we
 * default to the temporally-earliest actionable node so the "Prochain" button
 * naturally walks through branches in chronological order.
 */
export function resolveFocusedNodeId(
  graph: Graph,
  history: RunHistoryEntry[],
  frontiers: string[],
  stored: string | null
): string | null {
  const visited = visitedNodeIds(history)

  const isValid = (id: string | null): id is string => {
    if (!id) return false
    if (frontiers.includes(id)) return true
    if (!visited.has(id)) return false
    const node = graph.nodes.find(n => n.id === id)
    if (!node) return false
    // Start is never a valid focus once the run is live. Leaving Start picks
    // one outgoing edge arbitrarily (the first match in graph.edges) — for a
    // parallel fan-out that gates the chrono-earliest branch off the user's
    // first Prochain and adds the wrong target to history. Skipping Start here
    // pulls the initial focus straight onto the chrono-earliest frontier so
    // Prochain fires an `enter` on the right node instead.
    if (node.data.kind === 'end' || node.data.kind === 'start') return false
    return true
  }

  if (isValid(stored)) return stored

  const chrono = chronoEarliestActionableNodeId(graph, history, frontiers)
  if (chrono) return chrono

  const last = history[history.length - 1]
  if (last && isValid(last.nodeId)) return last.nodeId

  return frontiers[0] ?? null
}
