import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react'
import {
  edgeHaloStrokeWidth,
  edgeLabelTone,
  edgePathClass,
  edgeShowsHalo,
  edgeStrokeWidth,
  type FlowEdgeData
} from './edge-visual'

export function FlowEdge(props: EdgeProps) {
  const {
    id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    selected, sourceHandleId, data
  } = props
  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition
  })
  const edgeData = data as FlowEdgeData | undefined
  const handle = edgeData?.routeHandle ?? sourceHandleId ?? undefined
  const revealed = edgeData?.routeRevealed
  const strokeWidth = edgeStrokeWidth(!!selected)
  const pathClass = edgePathClass(handle, revealed)
  const halo = edgeShowsHalo(handle, revealed)
  const days = edgeData?.daysAfter ?? 0
  const routeLabel = edgeData?.routeLabel
  const highlighted = revealed !== false
  const labelBorder = !highlighted || !handle
    ? 'border-border bg-surface shadow-elev-1'
    : handle === 'success'
      ? 'border-emerald-500/70 bg-[#ECFDF5] ring-2 ring-emerald-400/35'
      : handle === 'failure'
        ? 'border-red-500/70 bg-[#FEF2F2] ring-2 ring-red-400/35'
        : 'border-indigo-400/60 bg-[#EEF2FF] ring-2 ring-indigo-300/35'

  const pathStyle = {
    strokeWidth,
    strokeLinecap: 'round' as const,
    transition: 'stroke-width 280ms ease, opacity 280ms ease'
  }
  const haloStyle = {
    ...pathStyle,
    strokeWidth: edgeHaloStrokeWidth(strokeWidth)
  }

  return (
    <>
      {halo ? (
        <path
          d={path}
          fill="none"
          pointerEvents="none"
          className={`react-flow__edge-path ${pathClass} rp-edge__halo`}
          style={haloStyle}
        />
      ) : null}
      <BaseEdge
        id={id}
        path={path}
        className={pathClass}
        style={pathStyle}
      />
      <EdgeLabelRenderer>
        <div
          className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums text-fg ${labelBorder}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          data-edge-label-id={id}
        >
          {routeLabel ? (
            <span className={`mr-1 ${highlighted ? 'font-bold' : 'font-semibold'} ${edgeLabelTone(handle, revealed)}`}>
              {routeLabel}
            </span>
          ) : null}
          + {days} j
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
