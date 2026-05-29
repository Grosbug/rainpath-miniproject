import { useMemo } from 'react'
import { useStore as useRFStore, useViewport } from '@xyflow/react'

/** Pixels between two adjacent days at zoom = 1. Calibrated to match the Canvas's PX_PER_DAY (28). */
const PX_PER_DAY = 28
const START_X_VIEW = 0

/**
 * Pick the gridline/label step in days so adjacent labels never overlap.
 * Steps belong to a 1-2-5 progression (then ×10) — the standard ladder used by
 * chart libraries for human-readable axes. The reserved width per label fits
 * "J+999" with a small margin.
 */
const LABEL_MIN_PX = 44
const STEP_LADDER = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]
function chooseStep(zoom: number): number {
  const pxPerDay = PX_PER_DAY * zoom
  for (const step of STEP_LADDER) {
    if (pxPerDay * step >= LABEL_MIN_PX) return step
  }
  return STEP_LADDER[STEP_LADDER.length - 1]!
}

export function TimelineBackground() {
  const viewport = useViewport()
  const widthPx = useRFStore(s => s.width)
  const heightPx = useRFStore(s => s.height)

  // Convert viewport bounds into "day" units.
  const stepDays = chooseStep(viewport.zoom)
  const pxPerDay = PX_PER_DAY * viewport.zoom

  const { leftDay, rightDay } = useMemo(() => {
    // X = (worldX * zoom) + viewport.x  → solve for worldX given screenX in [0, widthPx]
    const worldLeftX = -viewport.x / Math.max(viewport.zoom, 1e-6)
    const worldRightX = (widthPx - viewport.x) / Math.max(viewport.zoom, 1e-6)
    return {
      leftDay: Math.floor(worldLeftX / PX_PER_DAY) - 2,
      rightDay: Math.ceil(worldRightX / PX_PER_DAY) + 2
    }
  }, [viewport, widthPx])

  const ticks: number[] = []
  for (let d = Math.max(0, leftDay - (leftDay % stepDays)); d <= rightDay; d += stepDays) {
    ticks.push(d)
  }
  // Cap ~ 60 graduations (perf — DS §13).
  const capped = ticks.length > 60 ? ticks.filter((_, i) => i % 2 === 0) : ticks

  return (
    <div className='pointer-events-none absolute inset-0 overflow-hidden' style={{ zIndex: 0 }}>
      <svg
        width={widthPx}
        height={heightPx}
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        overflow='hidden'
        className='pointer-events-none block'
      >
        {capped.map(d => {
          const screenX = d * pxPerDay + viewport.x + START_X_VIEW
          // Strict clipping at the canvas edges — gridlines must never bleed left of x=0
          // (where the Palette sits) or right of widthPx.
          if (screenX < 0 || screenX > widthPx) return null
          return (
            <g key={d}>
              <line
                x1={screenX}
                y1={28}
                x2={screenX}
                y2={heightPx}
                stroke='var(--border)'
                strokeWidth={1}
              />
              <text
                x={screenX}
                y={18}
                fontSize={11}
                fontFamily='var(--font-sans)'
                style={{ fontVariantNumeric: 'tabular-nums' }}
                textAnchor='middle'
                fill='var(--fg-muted)'
              >
                J+{d}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
