import type { Graph } from '../schemas/primitives'

export type RunHistoryEntry = { nodeId: string; enteredAt: string; outcome?: string }

/** Scheduled day offset (J+N) from the workflow layout. */
export function nodeScheduledDay(graph: Graph, nodeId: string): number {
  const n = graph.nodes.find(x => x.id === nodeId)
  if (!n || n.data.kind === 'start') return 0
  return Math.max(0, Math.round(n.position.x))
}

export function visitedNodeIds(history: RunHistoryEntry[]): Set<string> {
  return new Set(history.map(h => h.nodeId))
}

/**
 * Nodes that may be entered next: every predecessor is visited, the node is not,
 * and its scheduled day equals the minimum day among all ready nodes (strict
 * temporal gate — finish all of J+N before any J+M with M > N).
 */
export function computeActiveFrontiers(graph: Graph, history: RunHistoryEntry[]): string[] {
  const visited = visitedNodeIds(history)
  const ready: string[] = []

  for (const n of graph.nodes) {
    if (visited.has(n.id)) continue
    const incoming = graph.edges.filter(e => e.target === n.id)
    if (incoming.length === 0) continue
    if (!incoming.every(e => visited.has(e.source))) continue
    ready.push(n.id)
  }

  if (ready.length === 0) return []

  const openDay = Math.min(...ready.map(id => nodeScheduledDay(graph, id)))
  return ready
    .filter(id => nodeScheduledDay(graph, id) === openDay)
    .sort()
}

export type NodeRunAction = 'enter' | 'leave'

/** Whether `nodeId` can be advanced (enter frontier or leave an visited node). */
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
  return 'leave'
}

/** Pick a valid focus id (stored preference, else focused node, else first frontier). */
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
    return !!node && node.data.kind !== 'end'
  }

  if (isValid(stored)) return stored

  const last = history[history.length - 1]
  if (last && isValid(last.nodeId)) return last.nodeId

  return frontiers[0] ?? null
}
