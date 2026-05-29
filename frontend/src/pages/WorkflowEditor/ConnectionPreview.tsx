import { useEffect, useState } from 'react'
import type { ConnectionInteraction, HandleRef } from './hooks/useClickConnection'

/**
 * Live floating preview of an in-progress click-to-create connection.
 *
 * Dashed line from the originating handle (anchored) to the cursor. Positioned
 * fixed-in-viewport so it survives canvas pans / zooms; the origin anchor is re-resolved
 * against the live DOM rect on every mouse move (cheap getBoundingClientRect).
 */
function findHandleEl(h: HandleRef): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    `.react-flow__handle[data-nodeid="${CSS.escape(h.nodeId)}"]`
  )
  for (const el of candidates) {
    const idAttr = el.getAttribute('data-handleid')
    const matchesId = h.handleId == null ? !idAttr || idAttr === 'null' : idAttr === h.handleId
    const matchesType = el.classList.contains(h.type)
    if (matchesId && matchesType) return el
  }
  return null
}

export function ConnectionPreview({ interaction }: { interaction: ConnectionInteraction }) {
  const [coords, setCoords] = useState<{ fx: number; fy: number; tx: number; ty: number } | null>(null)

  useEffect(() => {
    if (interaction.mode === 'idle') {
      setCoords(null)
      return
    }
    const fixedEl = findHandleEl(interaction.from)
    if (!fixedEl) return

    const init = fixedEl.getBoundingClientRect()
    setCoords({
      fx: init.left + init.width / 2,
      fy: init.top + init.height / 2,
      tx: init.left + init.width / 2,
      ty: init.top + init.height / 2
    })

    function onMove(e: MouseEvent) {
      // Re-read the fixed rect each move so pan/zoom of the canvas doesn't desync the line.
      const r = fixedEl!.getBoundingClientRect()
      setCoords({
        fx: r.left + r.width / 2,
        fy: r.top + r.height / 2,
        tx: e.clientX,
        ty: e.clientY
      })
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [interaction])

  if (interaction.mode === 'idle' || !coords) return null

  return (
    <svg
      className='pointer-events-none fixed inset-0 z-[1000]'
      style={{ width: '100vw', height: '100vh' }}
      aria-hidden='true'
    >
      <line
        x1={coords.fx}
        y1={coords.fy}
        x2={coords.tx}
        y2={coords.ty}
        stroke='var(--primary)'
        strokeWidth={2}
        strokeDasharray='5 4'
      />
      <circle cx={coords.tx} cy={coords.ty} r={4} fill='var(--primary)' />
    </svg>
  )
}
