import type { Graph, RunHistoryEntry } from '@rainpath/shared'
import { visitedNodeIds } from '@rainpath/shared'

/** True when a later history step reached a target of an outgoing edge from `nodeId`. */
export function hasExitedNode(graph: Graph, history: RunHistoryEntry[], nodeId: string): boolean {
  const visited = visitedNodeIds(history)
  return graph.edges.some(e => e.source === nodeId && visited.has(e.target))
}

function isStuckAtNode(graph: Graph, history: RunHistoryEntry[], nodeId: string): boolean {
  if (hasExitedNode(graph, history, nodeId)) return false
  if (!visitedNodeIds(history).has(nodeId)) return false
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node || node.data.kind === 'end') return false
  return graph.edges.filter(e => e.source === nodeId).length === 0
}

export function stuckReasonForNode(
  graph: Graph,
  history: RunHistoryEntry[],
  nodeId: string
): string | undefined {
  if (!isStuckAtNode(graph, history, nodeId)) return undefined
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node || node.data.kind === 'start' || node.data.kind === 'end') {
    return 'Sortie non branchée dans le workflow'
  }
  const outgoing = graph.edges.filter(e => e.source === nodeId)
  if (outgoing.length === 0) return 'Aucune sortie sur ce nœud'

  if (
    node.data.kind === 'send_email' ||
    node.data.kind === 'send_sms' ||
    node.data.kind === 'send_whatsapp' ||
    node.data.kind === 'send_postal'
  ) {
    const out = node.data.params.output
    if (out.mode === 'simple') {
      const hasSuccess = outgoing.some(e => e.sourceHandle === 'success')
      const hasFailure = outgoing.some(e => e.sourceHandle === 'failure')
      if (!hasFailure && !hasSuccess) return 'Aucune sortie branchée'
      if (!hasFailure) return 'Branche échec non branchée'
      if (!hasSuccess) return 'Branche succès non branchée'
    }
  }
  return 'Aucune étape suivante dans le workflow — enregistrez le statut observé pour continuer sur une autre branche.'
}

/**
 * Not yet in history, but a direct target of a visited node whose branch is still open.
 * Used for patient-canvas reachability (preview only — not an actionable frontier).
 */
export function isUpcomingFromOpenBranch(
  graph: Graph,
  history: RunHistoryEntry[],
  nodeId: string
): boolean {
  if (visitedNodeIds(history).has(nodeId)) return false
  for (const n of graph.nodes) {
    if (!visitedNodeIds(history).has(n.id)) continue
    if (hasExitedNode(graph, history, n.id)) continue
    if (graph.edges.some(e => e.source === n.id && e.target === nodeId)) return true
  }
  return false
}
