import { useMemo } from 'react'
import { Panel, useStore as useRFStore, useViewport } from '@xyflow/react'

/** Pixels between two adjacent days at zoom = 1. Calibrated to match the Canvas's PX_PER_DAY (28). */
const PX_PER_DAY = 28
const START_X_VIEW = 0

function chooseStep(zoom: number): number {
  if (zoom < 0.4) return 10
  if (zoom < 0.8) return 5
  return 1
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
    <Panel position='top-left' className='pointer-events-none m-0 p-0'>
      <svg
        width={widthPx}
        height={heightPx}
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        className='block'
      >
        {capped.map(d => {
          const screenX = d * pxPerDay + viewport.x + START_X_VIEW
          if (screenX < -40 || screenX > widthPx + 40) return null
          const isRail = d === 0
          return (
            <g key={d}>
              <line
                x1={screenX}
                y1={28}
                x2={screenX}
                y2={heightPx}
                stroke={isRail ? 'var(--node-start-accent)' : 'var(--border)'}
                strokeWidth={isRail ? 2 : 1}
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
    </Panel>
  )
}
