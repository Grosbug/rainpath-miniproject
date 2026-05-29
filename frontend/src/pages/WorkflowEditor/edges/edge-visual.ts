import type { Graph } from '@rainpath/shared'

/** Stroke + label tone for workflow / patient-run edges. */
export type FlowEdgeData = {
  daysAfter?: number
  routeLabel?: string
  /** Resolved succès / échec / multi id — mirrors graph `sourceHandle` when set. */
  routeHandle?: string
  /** Patient run: false = not yet traversed (neutral). Editor omits this. */
  routeRevealed?: boolean
}

type GraphEdge = Graph['edges'][number]

/**
 * Handle used for edge color + labels. Only explicit `sourceHandle` on the graph edge —
 * no guesswork (avoids coloring an échec branch as succès on legacy graphs).
 */
export function resolveEdgeDisplayHandle(edge: GraphEdge): string | undefined {
  if (edge.sourceHandle === 'success' || edge.sourceHandle === 'failure') {
    return edge.sourceHandle
  }
  if (edge.sourceHandle) return edge.sourceHandle
  return undefined
}

export function routeLabelForHandle(handle: string | undefined): string | undefined {
  if (handle === 'success') return 'Succès'
  if (handle === 'failure') return 'Échec'
  return undefined
}

export function edgePathClass(handle: string | undefined, routeRevealed?: boolean): string {
  if (routeRevealed === false) return 'rp-edge--neutral'
  if (handle === 'success') return 'rp-edge--success'
  if (handle === 'failure') return 'rp-edge--failure'
  if (handle) return 'rp-edge--multi'
  return 'rp-edge--plain'
}

export function edgeLabelTone(handle: string | undefined, routeRevealed?: boolean): string {
  if (routeRevealed === false) return 'text-fg-muted'
  if (handle === 'success') return 'text-success'
  if (handle === 'failure') return 'text-danger'
  if (handle) return 'text-indigo-600'
  return 'text-fg-muted'
}

export function edgeStrokeWidth(selected: boolean): number {
  return selected ? 2 : 1.5
}

export function edgeShowsHalo(handle: string | undefined, routeRevealed?: boolean): boolean {
  if (routeRevealed === false || !handle) return false
  return true
}

export function edgeHaloStrokeWidth(mainWidth: number): number {
  return mainWidth + 4
}
