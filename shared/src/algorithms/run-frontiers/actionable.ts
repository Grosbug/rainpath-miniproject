import type { Graph } from '../../schemas/primitives'
import {
  findLatestEntry,
  isSendKind,
  visitedNodeIds,
  type RunHistoryEntry
} from './helpers'
import { runDayAtNode } from './run-day'

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
