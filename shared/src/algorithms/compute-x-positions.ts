import type { Graph } from '../schemas/primitives'

/**
 * Compute X positions for every node in the graph based on edge.daysAfter.
 *
 * - The start node anchors at X=0.
 * - For any node reachable from start: X(node) = max over incoming edges of (X(source) + edge.daysAfter).
 * - Orphan nodes (not reachable from start) keep their `existingX` value, or 0 if absent.
 * - Throws on cycle within the connected component, or when no start node exists.
 */
export function computeXPositions(
  graph: Graph,
  existingX?: Map<string, number>
): Map<string, number> {
  const startNode = graph.nodes.find(n => n.data.kind === 'start')
  if (!startNode) {
    throw new Error('computeXPositions: no start node found')
  }

  // Build adjacency list (source -> outgoing edges) and incoming-degree map.
  const outgoing = new Map<string, typeof graph.edges>()
  const inDegree = new Map<string, number>()
  for (const n of graph.nodes) {
    outgoing.set(n.id, [])
    inDegree.set(n.id, 0)
  }
  for (const e of graph.edges) {
    if (!outgoing.has(e.source) || !inDegree.has(e.target)) continue
    outgoing.get(e.source)!.push(e)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  // Discover the connected component reachable from the start (BFS following outgoing edges).
  const connected = new Set<string>([startNode.id])
  const stack = [startNode.id]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const e of outgoing.get(id) ?? []) {
      if (!connected.has(e.target)) {
        connected.add(e.target)
        stack.push(e.target)
      }
    }
  }

  // Initialize X.
  const x = new Map<string, number>()
  x.set(startNode.id, 0)
  for (const n of graph.nodes) {
    if (!connected.has(n.id)) {
      x.set(n.id, existingX?.get(n.id) ?? 0)
    }
  }

  // Kahn's topological sort restricted to the connected component.
  const remainingIn = new Map<string, number>()
  for (const id of connected) {
    let count = 0
    for (const e of graph.edges) {
      if (e.target === id && connected.has(e.source)) count++
    }
    remainingIn.set(id, count)
  }

  const queue: string[] = [startNode.id]
  let visited = 0
  while (queue.length > 0) {
    const id = queue.shift()!
    visited++
    for (const e of outgoing.get(id) ?? []) {
      if (!connected.has(e.target)) continue
      const candidate = (x.get(id) ?? 0) + e.daysAfter
      const current = x.get(e.target)
      if (current === undefined || candidate > current) {
        x.set(e.target, candidate)
      }
      const r = (remainingIn.get(e.target) ?? 0) - 1
      remainingIn.set(e.target, r)
      if (r === 0) queue.push(e.target)
    }
  }

  if (visited < connected.size) {
    throw new Error('computeXPositions: cycle detected in connected component')
  }

  return x
}
