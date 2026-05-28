import type { Graph, GraphEdge, GraphNode } from '../schemas/primitives'

export type NodeReachState = 'visited' | 'current' | 'reachable' | 'blocked' | 'unreachable'

export interface PatientProfileLike {
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  address?: string | null
}

function evaluateDataAvailable(expression: string, profile: PatientProfileLike): boolean | undefined {
  switch (expression) {
    case 'patient.email':    return !!profile.email && profile.email !== ''
    case 'patient.phone':    return !!profile.phone && profile.phone !== ''
    case 'patient.whatsapp': return !!profile.whatsapp && profile.whatsapp !== ''
    case 'patient.address': return !!profile.address && profile.address !== ''
    default: return undefined
  }
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

interface OutgoingResolution {
  followed: GraphEdge[]
  skippedBlocked: GraphEdge[]
}

function resolveOutgoingEdges(node: GraphNode, edges: GraphEdge[], profile: PatientProfileLike): OutgoingResolution {
  const outgoing = edges.filter(e => e.source === node.id)
  switch (node.data.kind) {
    case 'start':
    case 'send_email':
    case 'send_sms':
    case 'send_whatsapp':
    case 'send_postal':
      return { followed: outgoing, skippedBlocked: [] }
    case 'condition': {
      const params = node.data.params
      if (params.conditionType === 'data_available') {
        const result = evaluateDataAvailable(params.expression, profile)
        if (result === undefined) {
          return { followed: outgoing, skippedBlocked: [] }
        }
        const trueEdge = outgoing.find(e => e.sourceHandle === 'true')
        const falseEdge = outgoing.find(e => e.sourceHandle === 'false')
        if (result) {
          return {
            followed: trueEdge ? [trueEdge] : [],
            skippedBlocked: falseEdge ? [falseEdge] : []
          }
        } else {
          return {
            followed: falseEdge ? [falseEdge] : [],
            skippedBlocked: trueEdge ? [trueEdge] : []
          }
        }
      }
      // previous_result : both branches potentially possible
      return { followed: outgoing, skippedBlocked: [] }
    }
    case 'end':
      return { followed: [], skippedBlocked: [] }
  }
}

/**
 * Compute the reachability state of every node from the perspective of `currentNodeId`,
 * given a patient profile and execution history. Idempotent and deterministic.
 */
export function computeReachability(
  graph: Graph,
  profile: PatientProfileLike,
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
    const { followed, skippedBlocked } = resolveOutgoingEdges(node, graph.edges, profile)
    for (const e of followed) {
      const target = state.get(e.target)
      if (target === 'unreachable' || target === 'blocked') state.set(e.target, 'reachable')
    }
    for (const e of skippedBlocked) {
      const target = state.get(e.target)
      if (target === 'unreachable') state.set(e.target, 'blocked')
    }
  }
  return state
}
