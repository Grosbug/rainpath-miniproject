import { useMemo } from 'react'
import { useStore as useRFStore, useViewport } from '@xyflow/react'
import { usePxPerDay } from '@/canvas/time-scale'

const START_X_VIEW = 0

const LABEL_MIN_PX = 44
const STEP_LADDER = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]
/**
 * Choisit le pas (en jours) entre deux graduations pour que les labels ne se
 * chevauchent jamais. `pxPerDayOnScreen` = pixels par jour réellement affichés
 * (densité × zoom). Échelle 1-2-5 standard.
 */
export function chooseStep(pxPerDayOnScreen: number): number {
  for (const step of STEP_LADDER) {
    if (pxPerDayOnScreen * step >= LABEL_MIN_PX) return step
  }
  return STEP_LADDER[STEP_LADDER.length - 1]!
}

export function TimelineBackground() {
  const viewport = useViewport()
  const widthPx = useRFStore(s => s.width)
  const heightPx = useRFStore(s => s.height)
  // px par jour : densité « monde » (usePxPerDay) × zoom RF = px écran.
  const worldPxPerDay = usePxPerDay()

  // Convert viewport bounds into "day" units.
  const pxPerDay = worldPxPerDay * viewport.zoom
  const stepDays = chooseStep(pxPerDay)

  const { leftDay, rightDay } = useMemo(() => {
    // X = (worldX * zoom) + viewport.x  → solve for worldX given screenX in [0, widthPx]
    const worldLeftX = -viewport.x / Math.max(viewport.zoom, 1e-6)
    const worldRightX = (widthPx - viewport.x) / Math.max(viewport.zoom, 1e-6)
    return {
      leftDay: Math.floor(worldLeftX / worldPxPerDay) - 2,
      rightDay: Math.ceil(worldRightX / worldPxPerDay) + 2
    }
  }, [viewport, widthPx, worldPxPerDay])

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
