import { TimeScaleControl } from './TimeScaleControl'

/**
 * Floating top-center overlay hosting the temporal-density control inside a
 * canvas. Lives in the canvas (not the page toolbar) so the control sits where
 * it acts; `pointer-events-none` on the wrapper lets canvas drags pass through
 * the empty margins, while the pill itself re-enables pointer events. The
 * backdrop-blurred surface keeps it legible over the timeline graduations it
 * overlaps. Sits above nodes (z-20) but the canvas wrapper renders it after the
 * React Flow pane, so it never blocks node interaction outside its own bounds.
 */
export function CanvasOverlayControl() {
  return (
    <div className='pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center'>
      <div className='pointer-events-auto origin-top scale-[0.82] rounded-md border border-border/60 bg-surface/90 px-1.5 py-0.5 shadow-elev-1 backdrop-blur-md'>
        <TimeScaleControl />
      </div>
    </div>
  )
}
