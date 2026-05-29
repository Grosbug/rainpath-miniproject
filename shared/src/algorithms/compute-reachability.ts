import type { Graph, GraphEdge, GraphNode } from '../schemas/primitives'
import type { PostalAddress } from '../schemas/api-dtos'

export type NodeReachState = 'visited' | 'current' | 'reachable' | 'blocked' | 'unreachable'

/** Structural shape used by the reachability evaluator. Accepts both the new structured
 *  postal address and a plain string for backward compatibility (legacy profiles). */
export interface PatientProfileLike {
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  address?: PostalAddress | string | null
}

function topologicalOrder(graph: Graph, root: string): string[] {
  const outgoing = new Map<string, GraphEdge[]>()
  const inDeg = new Map<string, number>()
  for (const n of graph.nodes) { outgoing.set(n.id, []); inDeg.set(n.id, 0) }
  for (const e of graph.edges) {
    if (!outgoing.has(e.source) || !inDeg.has(e.target)) continue
    if (e.source === e.target) continue
    outgoing.get(e.source)!.push(e)
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
  }
  // BFS from root to find connected component
  const connected = new Set<string>([root])
  const stack = [root]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const e of outgoing.get(id) ?? []) {
      if (!connected.has(e.target)) {
        connected.add(e.target)
        stack.push(e.target)
      }
    }
  }
  const order: string[] = []
  const queue = [root]
  const localIn = new Map<string, number>()
  for (const id of connected) {
    let count = 0
    for (const e of graph.edges) {
      if (e.target === id && connected.has(e.source) && e.source !== id) count++
    }
    localIn.set(id, count)
  }
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const e of outgoing.get(id) ?? []) {
      if (!connected.has(e.target)) continue
      const r = (localIn.get(e.target) ?? 0) - 1
      localIn.set(e.target, r)
      if (r === 0) queue.push(e.target)
    }
  }
  return order
}

function resolveOutgoingEdges(node: GraphNode, edges: GraphEdge[]): GraphEdge[] {
  if (node.data.kind === 'end') return []
  return edges.filter(e => e.source === node.id)
}

/**
 * Compute the reachability state of every node from the perspective of `currentNodeId`,
 * given a patient profile and execution history. Idempotent and deterministic.
 *
 * Without condition nodes, branching is entirely outcome-driven (send-node success /
 * failure / multi-output handles). All outgoing edges of a non-end node are treated
 * as "reachable" — we don't try to predict which outcome the simulator will pick.
 */
export function computeReachability(
  graph: Graph,
  _profile: PatientProfileLike,
  currentNodeId: string | null,
  history: string[]
): Map<string, NodeReachState> {
  const state = new Map<string, NodeReachState>()
  for (const n of graph.nodes) state.set(n.id, 'unreachable')
  for (const id of history) if (state.has(id)) state.set(id, 'visited')
  if (currentNodeId && state.has(currentNodeId)) state.set(currentNodeId, 'current')

  if (!currentNodeId) return state

  const order = topologicalOrder(graph, currentNodeId)
  const nodesById = new Map(graph.nodes.map(n => [n.id, n]))

  for (const id of order) {
    const node = nodesById.get(id)
    if (!node) continue
    const here = state.get(id)
    const canPropagate = here === 'current' || here === 'visited' || here === 'reachable'
    if (!canPropagate) continue
    for (const e of resolveOutgoingEdges(node, graph.edges)) {
      const target = state.get(e.target)
      if (target === 'unreachable' || target === 'blocked') state.set(e.target, 'reachable')
    }
  }
  return state
}
