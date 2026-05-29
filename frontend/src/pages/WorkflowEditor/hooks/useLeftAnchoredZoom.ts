import { useRef } from 'react'
import { useReactFlow, useOnViewportChange } from '@xyflow/react'

/**
 * Left-anchor the horizontal zoom on the canvas: whenever the user changes
 * zoom (wheel, pinch, Controls buttons), force viewport.x back to `anchorX`
 * so the timeline origin (J+0) stays visually fixed at the left edge instead
 * of drifting away from it — React Flow's default cursor-centered zoom would
 * otherwise pull world x=0 toward the cursor.
 *
 * Horizontal panning (zoom unchanged) is untouched: the user can still pan
 * along the timeline, only zoom is constrained. A small post-snap is
 * acceptable; if flicker becomes visible we'd need to intercept wheel events
 * directly instead of correcting after-the-fact.
 */
export function useLeftAnchoredZoom(anchorX = 0) {
  const { setViewport } = useReactFlow()
  const prevZoom = useRef<number | null>(null)
  const programmatic = useRef(false)

  useOnViewportChange({
    onChange: ({ x, y, zoom }) => {
      if (programmatic.current) {
        programmatic.current = false
        prevZoom.current = zoom
        return
      }
      if (prevZoom.current !== null && zoom !== prevZoom.current && x !== anchorX) {
        programmatic.current = true
        setViewport({ x: anchorX, y, zoom }, { duration: 0 })
      }
      prevZoom.current = zoom
    }
  })
}
