import { useEffect, useRef } from 'react'
import { Icon } from '@/components/Icon'

interface Props {
  open: boolean
  /** Center point of the clicked chip in viewport coords. The popover is rendered with
   *  its own center on this point so it overlays the "+ N j" label exactly. */
  anchor: { x: number; y: number } | null
  onCancel: () => void
  onDelete: () => void
}

/**
 * Compact action popover for an edge chip — only a delete button. The delay itself is
 * edited exclusively by dragging the connected nodes (the edge's daysAfter is rewritten
 * when the source/target node X shifts), so an explicit input would be redundant.
 *
 * Positioning is intentionally NOT delegated to Floating-UI: with a zero-size reference
 * point Floating-UI already centers horizontally (placement: 'bottom' default), so
 * applying `translate(-50%, -50%)` on top of its computed `left` shifted the popover
 * an extra `width/2` to the left of the chip. We therefore position manually here —
 * `position: fixed` + literal `left/top: anchor.x/y` + a single `translate(-50%, -50%)`
 * gives a precise overlay regardless of popover size.
 *
 * Dismissal (Escape, outside click) is hand-rolled with a global pointerdown listener
 * gated on the popover's own ref.
 */
export function DaysAfterPopover({ open, anchor, onCancel, onDelete }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) onCancel()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    // Defer one frame so the click that opened the popover doesn't immediately close it.
    const raf = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', onPointerDown, true)
    })
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onCancel])

  if (!open || !anchor) return null

  return (
    <div
      ref={ref}
      role='dialog'
      style={{
        position: 'fixed',
        left: anchor.x,
        top: anchor.y,
        transform: 'translate(-50%, -50%)'
      }}
      className='z-50 flex min-w-[60px] items-center justify-center rounded-full border border-border bg-surface px-2 py-1 shadow-elev-2'
    >
      <button
        type='button'
        onClick={onDelete}
        aria-label='Supprimer la connexion'
        data-rp-tooltip='Supprimer la connexion'
        className='inline-flex h-7 w-7 items-center justify-center rounded-full text-danger hover:bg-[#FEF2F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger'
      >
        <Icon name='Trash2' size={16} />
      </button>
    </div>
  )
}
