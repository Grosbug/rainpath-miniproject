import type { Graph, GraphEdge } from '../schemas/primitives'
import { computeXPositions } from './compute-x-positions'

export interface SimulateResult {
  cycle: boolean
  selfLoop: boolean
  handleConflict: boolean
  newX: Map<string, number>
  shifts: Map<string, { from: number; to: number }>
}

function computeXSafe(graph: Graph, existingX?: Map<string, number>): { x: Map<string, number>; cycle: boolean } {
  try {
    return { x: computeXPositions(graph, existingX), cycle: false }
  } catch (err) {
    if ((err as Error).message.match(/cycle/i)) {
      return { x: new Map(), cycle: true }
    }
    throw err
  }
}

function diff(before: Map<string, number>, after: Map<string, number>): Map<string, { from: number; to: number }> {
  const out = new Map<string, { from: number; to: number }>()
  for (const [id, to] of after) {
    const from = before.get(id) ?? 0
    if (from !== to) out.set(id, { from, to })
  }
  return out
}

export function simulateAddEdge(
  graph: Graph,
  source: string,
  target: string,
  daysAfter: number,
  sourceHandle?: string
): SimulateResult {
  const selfLoop = source === target
  const handleConflict = graph.edges.some(e => e.source === source && e.sourceHandle === sourceHandle && sourceHandle !== undefined)
  const beforeX = computeXSafe(graph).x

  if (selfLoop || handleConflict) {
    return { cycle: false, selfLoop, handleConflict, newX: beforeX, shifts: new Map() }
  }

  const newEdge: GraphEdge = { id: '__simulated__', source, target, daysAfter, sourceHandle }
  const draft: Graph = { nodes: graph.nodes, edges: [...graph.edges, newEdge] }
  const after = computeXSafe(draft, beforeX)
  if (after.cycle) {
    return { cycle: true, selfLoop: false, handleConflict: false, newX: beforeX, shifts: new Map() }
  }
  return {
    cycle: false, selfLoop: false, handleConflict: false,
    newX: after.x,
    shifts: diff(beforeX, after.x)
  }
}

export function simulateChangeDaysAfter(
  graph: Graph,
  edgeId: string,
  newDaysAfter: number
): { cycle: boolean; newX: Map<string, number>; shifts: Map<string, { from: number; to: number }> } {
  const beforeX = computeXSafe(graph).x
  const draft: Graph = {
    nodes: graph.nodes,
    edges: graph.edges.map(e => e.id === edgeId ? { ...e, daysAfter: newDaysAfter } : e)
  }
  const after = computeXSafe(draft, beforeX)
  if (after.cycle) {
    return { cycle: true, newX: beforeX, shifts: new Map() }
  }
  return { cycle: false, newX: after.x, shifts: diff(beforeX, after.x) }
}

export function simulateRemoveEdge(
  graph: Graph,
  edgeId: string
): { newX: Map<string, number>; shifts: Map<string, { from: number; to: number }> } {
  const beforeX = computeXSafe(graph).x
  const draft: Graph = {
    nodes: graph.nodes,
    edges: graph.edges.filter(e => e.id !== edgeId)
  }
  // After removal, do not pass existingX of nodes that become orphans — let them default to 0 per spec
  const after = computeXSafe(draft).x
  return { newX: after, shifts: diff(beforeX, after) }
}
