import type { GraphNode, GraphEdge } from '../snapshot'
import { isValidDiscreteSourceHandle } from '../source-handle'

/**
 * Outcome of a connection-validity check. Same code vocabulary as the store's `addEdge`
 * so the proactive (hover) and reactive (commit) layers stay in lockstep — change one,
 * keep the other in mind.
 */
export type ConnectionValidationCode =
  | 'ok'
  | 'self_loop'
  | 'dangling'
  | 'edge_into_start'
  | 'edge_from_end'
  | 'incompatible_handles'
  | 'cycle'
  | 'unreachable_source'

export interface ProposedConnection {
  sourceNodeId: string
  /** May be null/undefined for nodes with a single implicit source slot (start, …). */
  sourceHandleId?: string | null
  targetNodeId: string
  /** Side the source handle belongs to (always 'source'); kept for symmetry with target. */
  sourceType?: 'source' | 'target'
  targetType?: 'source' | 'target'
}

interface GraphSnapshot {
  nodes: ReadonlyArray<GraphNode>
  edges: ReadonlyArray<GraphEdge>
}

/**
 * Mirror of the store's addEdge rejection rules, factored out so two callers can share it:
 *   1. React Flow's `isValidConnection` prop — gates drag-to-connect at the handle level
 *      so RF paints the connection line green/red while the user is mid-drag.
 *   2. The click-connect hover layer — toggles a CSS attribute on the hovered handle so
 *      the user sees compatibility BEFORE committing the second click.
 *
 * `excludeEdgeId` skips one edge from the existing set — useful during reconnection where
 * the old edge is still in the graph but is conceptually being replaced, so its presence
 * shouldn't trigger a spurious cycle / single-incoming verdict.
 */
export function validateConnection(
  p: ProposedConnection,
  graph: GraphSnapshot,
  opts: { excludeEdgeId?: string } = {}
): ConnectionValidationCode {
  if (p.sourceType && p.targetType && p.sourceType === p.targetType) {
    return 'incompatible_handles'
  }
  if (p.sourceNodeId === p.targetNodeId) return 'self_loop'

  const sourceNode = graph.nodes.find(n => n.id === p.sourceNodeId)
  const targetNode = graph.nodes.find(n => n.id === p.targetNodeId)
  if (!sourceNode || !targetNode) return 'dangling'
  if (targetNode.data.kind === 'start') return 'edge_into_start'
  if (sourceNode.data.kind === 'end') return 'edge_from_end'

  if (!isValidDiscreteSourceHandle(sourceNode, p.sourceHandleId)) {
    return 'incompatible_handles'
  }

  const edges = opts.excludeEdgeId
    ? graph.edges.filter(e => e.id !== opts.excludeEdgeId)
    : graph.edges

  // Cycle check: would adding source → target create a path target → … → source?
  // DFS from target along outgoing edges. If we hit source, the new edge would close a cycle.
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const list = adj.get(e.source)
    if (list) list.push(e.target)
    else adj.set(e.source, [e.target])
  }
  const seen = new Set<string>([p.targetNodeId])
  const stack = [p.targetNodeId]
  while (stack.length > 0) {
    const cur = stack.pop()!
    for (const next of adj.get(cur) ?? []) {
      if (next === p.sourceNodeId) return 'cycle'
      if (!seen.has(next)) { seen.add(next); stack.push(next) }
    }
  }

  // Unreachable-source guard: an orphan source can't legitimately feed into a node that
  // already belongs to the main timeline (same rule as the store).
  const start = graph.nodes.find(n => n.data.kind === 'start')
  if (start) {
    const reach = new Set<string>([start.id])
    const rs = [start.id]
    while (rs.length > 0) {
      const cur = rs.pop()!
      for (const next of adj.get(cur) ?? []) {
        if (!reach.has(next)) { reach.add(next); rs.push(next) }
      }
    }
    if (!reach.has(p.sourceNodeId) && reach.has(p.targetNodeId)) {
      return 'unreachable_source'
    }
  }

  return 'ok'
}
