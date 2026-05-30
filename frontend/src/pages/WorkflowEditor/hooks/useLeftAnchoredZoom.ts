import { useEffect, useRef } from 'react'
import {
  useReactFlow,
  useOnViewportChange,
  useStore as useRFStore
} from '@xyflow/react'

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
 *
 * Left re-anchor on width changes (T1, v3): the mount-time framing (zoom +
 * vertical centering) is owned entirely by the `<ReactFlow fitView>` prop on
 * each canvas — this hook NEVER calls `fitView` itself. It only ever forces
 * `viewport.x` back to `anchorX`. Because J+0 is drawn at world x=0 (screenX =
 * viewport.x) and the React Flow container is anchored to the LEFT of the
 * layout, the left edge of the canvas does not move when the right side panel
 * toggles or the window resizes — only the width grows/shrinks. So as long as
 * `viewport.x === anchorX`, J+0 stays flush left at ANY width, and there is
 * nothing to re-fit on a width change.
 *
 * Why v2 flickered (the regression this v3 fixes): v2 called `fitView` inside
 * the width effect on every measured width. `fitView` re-frames AND re-zooms the
 * whole graph (a visible jump), then the `requestAnimationFrame` snapped `x`
 * back to `anchorX` — exactly the "it darts and comes back" flicker on every
 * side-panel toggle. Removing the per-width `fitView` removes the jump.
 *
 * So the width effect now:
 *   - On the FIRST measured width (> 0): the mount `fitView` has run/centered the
 *     content, so on the next animation frame we read the fitted viewport and, if
 *     `x !== anchorX`, override ONLY `x` to `anchorX` (keeping the fitted `y` and
 *     `zoom`). This turns the centered opening into a left-anchored one.
 *   - On SUBSEQUENT widths (toggle, resize): no fit to wait for, so we just
 *     re-assert the anchor — read the viewport and, only if `x !== anchorX`,
 *     `setViewport({ x: anchorX, y, zoom })`. Zoom and y are untouched, so there
 *     is no visible movement; usually `x` is already `anchorX`, making it a no-op.
 */
// fitView (via the ReactFlow `fitView` prop) can run a frame or two after
// mount, and on small workflows it caps at maxZoom=1 — so the only thing it
// touches is the horizontal centering, NOT the zoom. Without a grace period,
// the post-mount snap to anchorX gets overwritten by fitView and the regular
// onChange handler skips re-anchoring (because zoom hasn't changed). For the
// first MOUNT_GRACE_MS milliseconds after the hook mounts, every viewport
// change re-asserts the anchor; after that we revert to the normal "snap only
// on zoom change" so the user's horizontal panning is respected.
const MOUNT_GRACE_MS = 300

export function useLeftAnchoredZoom(anchorX = 0) {
  const { setViewport, getViewport } = useReactFlow()
  const prevZoom = useRef<number | null>(null)
  const programmatic = useRef(false)
  const mountedAt = useRef(0)
  useEffect(() => {
    mountedAt.current = performance.now()
  }, [])

  useOnViewportChange({
    onChange: ({ x, y, zoom }) => {
      if (programmatic.current) {
        programmatic.current = false
        prevZoom.current = zoom
        return
      }
      const inGrace = performance.now() - mountedAt.current < MOUNT_GRACE_MS
      const zoomChanged = prevZoom.current !== null && zoom !== prevZoom.current
      if ((inGrace || zoomChanged) && x !== anchorX) {
        programmatic.current = true
        setViewport({ x: anchorX, y, zoom }, { duration: 0 })
      }
      prevZoom.current = zoom
    }
  })

  // Left-anchor whenever the RF container width changes — including the first
  // measured width, so the initial (centered) open becomes left-anchored too.
  // `store.width` is driven by React Flow's own ResizeObserver, so this covers
  // window resizes AND layout-driven width changes such as the run view's
  // side-panel toggle resizing the grid column. We NEVER re-fit here (see the
  // doc comment): the canvas's left edge doesn't move on these changes, so
  // re-asserting `x = anchorX` is all that's needed — and it's a no-op move
  // whenever `x` is already `anchorX`.
  const width = useRFStore(s => s.width)
  const prevWidth = useRef<number | null>(null)
  useEffect(() => {
    // Wait until RF has measured a real width.
    if (width <= 0) return
    // Act on every NEW width (incl. the first). The "unchanged width" guard is
    // what stops any loop: our own override of `x` does not change
    // `store.width`, so this effect won't re-run because of it.
    if (width === prevWidth.current) return
    const isFirst = prevWidth.current === null
    prevWidth.current = width

    // Snap `x` to `anchorX`, keeping the current `y` and `zoom` (so there is no
    // visible movement beyond the horizontal anchor). `programmatic.current` is
    // set BEFORE the mutation so the onViewportChange it triggers is recognized
    // as ours and the zoom watcher doesn't re-anchor on top of it.
    const anchor = () => {
      const vp = getViewport()
      if (vp.x === anchorX) {
        // Already anchored — keep prevZoom in sync, skip a redundant setViewport.
        prevZoom.current = vp.zoom
        return
      }
      programmatic.current = true
      setViewport({ x: anchorX, y: vp.y, zoom: vp.zoom }, { duration: 0 })
      prevZoom.current = vp.zoom
    }

    if (isFirst) {
      // First width: the mount `fitView` may apply its transform one frame
      // later, so wait a frame before reading the fitted viewport — otherwise
      // we'd anchor against a pre-fit `x`.
      const raf = requestAnimationFrame(anchor)
      return () => cancelAnimationFrame(raf)
    }

    // Subsequent widths (toggle, resize): no fit to wait for; re-assert the
    // anchor directly. Most often a no-op since `x` is already `anchorX`.
    anchor()
  }, [width, anchorX, getViewport, setViewport])
}
