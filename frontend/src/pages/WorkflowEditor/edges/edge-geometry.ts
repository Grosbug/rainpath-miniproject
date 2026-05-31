import { useStore, type ReactFlowState } from '@xyflow/react'
import { useMemo } from 'react'

export type EdgeSiblings = {
  /** Index of this edge among edges sharing the SAME (source, target) pair — true parallels. */
  pairIndex: number
  pairCount: number
  /** Index of this edge among edges leaving the same source node, regardless of target. */
  sourceIndex: number
  sourceCount: number
}

const selectEdgeKeys = (s: ReactFlowState) =>
  s.edges.map((e) => `${e.id}␟${e.source}␟${e.target}`).join('␞')

export function useEdgeSiblings(id: string, source: string, target: string): EdgeSiblings {
  const key = useStore(selectEdgeKeys)
  return useMemo(() => {
    const tuples = key
      ? key.split('␞').map((row) => {
          const [eid, src, tgt] = row.split('␟')
          return { id: eid, source: src, target: tgt }
        })
      : []
    const pair = tuples
      .filter((e) => e.source === source && e.target === target)
      .sort((a, b) => a.id.localeCompare(b.id))
    const fromSource = tuples
      .filter((e) => e.source === source)
      .sort((a, b) => a.id.localeCompare(b.id))
    return {
      pairIndex: Math.max(0, pair.findIndex((e) => e.id === id)),
      pairCount: pair.length || 1,
      sourceIndex: Math.max(0, fromSource.findIndex((e) => e.id === id)),
      sourceCount: fromSource.length || 1
    }
  }, [key, id, source, target])
}

type GeometryInput = {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  /** Perpendicular displacement (px) applied to both control points to fan parallel edges apart. */
  perpOffset?: number
  /** Bezier parameter (0–1) at which to anchor the label. Default 0.5 = midpoint. */
  labelT?: number
}

const HORIZONTAL_CTRL_FRACTION = 0.5
const MIN_HORIZONTAL_CTRL = 40

export function buildEdgeGeometry({
  sourceX,
  sourceY,
  targetX,
  targetY,
  perpOffset = 0,
  labelT = 0.5
}: GeometryInput): { path: string; labelX: number; labelY: number } {
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const ctrlExtent = Math.max(Math.abs(dx) * HORIZONTAL_CTRL_FRACTION, MIN_HORIZONTAL_CTRL)

  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len

  const c1x = sourceX + ctrlExtent + nx * perpOffset
  const c1y = sourceY + ny * perpOffset
  const c2x = targetX - ctrlExtent + nx * perpOffset
  const c2y = targetY + ny * perpOffset

  const path = `M${sourceX},${sourceY} C${c1x},${c1y} ${c2x},${c2y} ${targetX},${targetY}`

  const t = labelT
  const mt = 1 - t
  const labelX =
    mt * mt * mt * sourceX + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * targetX
  const labelY =
    mt * mt * mt * sourceY + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * targetY

  return { path, labelX, labelY }
}
