import { useEffect, useState } from 'react'

/**
 * App-wide custom tooltip host. Replaces the browser-default `title` attribute
 * (OS-styled, delayed, ugly) with a styled rounded pill that follows the cursor.
 *
 * Usage: put `data-rp-tooltip="…"` on any element. Mount `<Tooltip />` once at
 * the app root (AppLayout). Event delegation on `document` makes a single
 * listener pair handle every tooltip in the tree — no per-component wiring.
 *
 * Accessibility: keep `aria-label` on interactive elements; the tooltip is a
 * purely visual / mouse affordance.
 */
export function Tooltip() {
  const [tip, setTip] = useState<{ text: string; wrap: boolean; x: number; y: number } | null>(null)

  useEffect(() => {
    function resolve(el: EventTarget | null): { text: string; wrap: boolean } | null {
      const host = (el as HTMLElement | null)?.closest<HTMLElement>('[data-rp-tooltip]')
      if (!host) return null
      const text = host.getAttribute('data-rp-tooltip')
      if (!text) return null
      return { text, wrap: host.hasAttribute('data-rp-tooltip-wrap') }
    }

    function onOver(e: MouseEvent) {
      const match = resolve(e.target)
      if (!match) return
      setTip({ ...match, x: e.clientX, y: e.clientY })
    }
    function onMove(e: MouseEvent) {
      // Re-position only while still hovering a tooltip-capable element.
      const match = resolve(e.target)
      if (!match) {
        setTip(null)
        return
      }
      setTip({ ...match, x: e.clientX, y: e.clientY })
    }
    function onOut(e: MouseEvent) {
      if (!resolve(e.relatedTarget)) setTip(null)
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseout', onOut)
    return () => {
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseout', onOut)
    }
  }, [])

  if (!tip) return null
  return (
    <div
      role='tooltip'
      className={
        tip.wrap
          // Wrapping variant — rectangular, capped width, leading-snug. Use `data-rp-tooltip-wrap` for long sentences.
          ? 'pointer-events-none fixed z-[1100] max-w-xs rounded-md bg-fg px-2.5 py-1.5 text-xs font-medium leading-snug text-bg shadow-elev-2'
          : 'pointer-events-none fixed z-[1100] whitespace-nowrap rounded-full bg-fg px-3 py-1 text-xs font-medium text-bg shadow-elev-2'
      }
      // 14 px right of the cursor; slight upward shift so the pill's middle aligns with the cursor row.
      style={{ left: tip.x + 14, top: tip.y - 10 }}
    >
      {tip.text}
    </div>
  )
}
