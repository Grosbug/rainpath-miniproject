import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react'

export function FlowEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data } = props
  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition
  })
  const stroke = selected ? 'var(--primary)' : 'var(--fg-subtle)'
  const strokeWidth = selected ? 2 : 1.5
  const days = (data as { daysAfter?: number } | undefined)?.daysAfter ?? 0
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke, strokeWidth }} />
      <EdgeLabelRenderer>
        <div
          className='pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium tabular-nums text-fg shadow-elev-1'
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          data-edge-label-id={id}
        >
          + {days} j
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
