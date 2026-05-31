import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react'
import { useCallback } from 'react'
import {
  edgeHaloStrokeWidth,
  edgeLabelTone,
  edgePathClass,
  edgeShowsHalo,
  edgeStrokeWidth,
  type FlowEdgeData
} from './edge-visual'
import { buildEdgeGeometry, useEdgeSiblings } from './edge-geometry'
import { useEdgeHover } from './edge-hover-state'

const PARALLEL_FAN_SPREAD = 32
const SOURCE_LABEL_T_STEP = 0.1
const HOVER_STROKE_BOOST = 1.6
const DIMMED_OPACITY = 0.32

export function FlowEdge(props: EdgeProps) {
  const {
    id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    selected, sourceHandleId, data
  } = props
  const { pairIndex, pairCount, sourceIndex, sourceCount } = useEdgeSiblings(id, source, target)
  const needsCustom = pairCount > 1 || sourceCount > 1
  const [path, labelX, labelY] = needsCustom
    ? (() => {
        const perpOffset =
          pairCount > 1 ? (pairIndex - (pairCount - 1) / 2) * PARALLEL_FAN_SPREAD : 0
        const labelT =
          sourceCount > 1
            ? 0.5 + (sourceIndex - (sourceCount - 1) / 2) * SOURCE_LABEL_T_STEP
            : 0.5
        const g = buildEdgeGeometry({ sourceX, sourceY, targetX, targetY, perpOffset, labelT })
        return [g.path, g.labelX, g.labelY] as const
      })()
    : getBezierPath({
        sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition
      })
  const edgeData = data as FlowEdgeData | undefined
  const handle = edgeData?.routeHandle ?? sourceHandleId ?? undefined
  const revealed = edgeData?.routeRevealed
  const baseStrokeWidth = edgeStrokeWidth(!!selected)
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

  const hoveredEdgeId = useEdgeHover(s => s.hoveredEdgeId)
  const setHoveredEdge = useEdgeHover(s => s.setHoveredEdge)
  const isHovered = hoveredEdgeId === id
  const isDimmed = hoveredEdgeId !== null && !isHovered
  const onLabelEnter = useCallback(() => setHoveredEdge(id), [id, setHoveredEdge])
  const onLabelLeave = useCallback(() => setHoveredEdge(null), [setHoveredEdge])

  const strokeWidth = isHovered ? baseStrokeWidth * HOVER_STROKE_BOOST : baseStrokeWidth
  const pathStyle = {
    strokeWidth,
    strokeLinecap: 'round' as const,
    opacity: isDimmed ? DIMMED_OPACITY : 1,
    transition: 'stroke-width 180ms ease, opacity 180ms ease'
  }
  const haloStyle = {
    ...pathStyle,
    strokeWidth: edgeHaloStrokeWidth(strokeWidth)
  }
  const labelStyle: React.CSSProperties = {
    transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)${isHovered ? ' scale(1.08)' : ''}`,
    opacity: isDimmed ? DIMMED_OPACITY : 1,
    transition: 'opacity 180ms ease, transform 180ms ease, box-shadow 180ms ease',
    boxShadow: isHovered ? '0 4px 14px rgba(0,0,0,0.18)' : undefined,
    // Hovered: 10 (top of the EdgeLabelRenderer portal). Dimmed siblings
    // explicitly drop to 1 so DOM order can't put a later-rendered chip on
    // top of the hovered one. Idle baseline 2 → no relative shuffle when
    // nothing's hovered.
    zIndex: isHovered ? 10 : isDimmed ? 1 : 2
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
        interactionWidth={20}
      />
      <EdgeLabelRenderer>
        {/* Hover overlay — duplicate the path (and its halo) inside the label
            portal so the stroke lifts above any node it crosses. The portal's
            container sits at z-index 1500 (globals.css), which beats every
            node's z-index. SVG is `overflow: visible` so a 0×0 viewbox doesn't
            clip the absolute path coordinates, and `pointer-events: none`
            keeps the overlay from stealing the underlying edge's hit area
            (the original BaseEdge still handles interaction). */}
        {isHovered ? (
          <svg
            className="absolute left-0 top-0"
            // z-index 5 sits above the dimmed/idle sibling labels in this
            // portal (1 and 2 respectively) but below the hovered label's
            // own chip (10) so the chip stays readable on top of its line.
            style={{ overflow: 'visible', pointerEvents: 'none', zIndex: 5 }}
            aria-hidden="true"
          >
            {halo ? (
              <path
                d={path}
                fill="none"
                className={`react-flow__edge-path ${pathClass} rp-edge__halo`}
                style={haloStyle}
              />
            ) : null}
            <path
              d={path}
              fill="none"
              className={`react-flow__edge-path ${pathClass}`}
              style={pathStyle}
            />
          </svg>
        ) : null}
        <div
          className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums text-fg ${labelBorder}`}
          style={labelStyle}
          onMouseEnter={onLabelEnter}
          onMouseLeave={onLabelLeave}
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
