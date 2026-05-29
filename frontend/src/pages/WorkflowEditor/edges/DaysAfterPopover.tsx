import { useEffect, useRef } from 'react'
import { Icon } from '@/components/Icon'

interface Props {
  open: boolean
  /** Right-center of the edge label chip in viewport coords — popover sits just to its right. */
  anchor: { x: number; y: number } | null
  onCancel: () => void
  onDelete: () => void
}

/**
 * Compact delete control for an edge chip — a single trash button sized to its content.
 * Positioned immediately to the right of the label, vertically centered on it.
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
        transform: 'translate(6px, -50%)'
      }}
      className='z-50'
    >
      <button
        type='button'
        onClick={onDelete}
        aria-label='Supprimer la connexion'
        data-rp-tooltip='Supprimer la connexion'
        className='inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-danger shadow-elev-2 hover:bg-[#FEF2F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger'
      >
        <Icon name='Trash2' size={16} />
      </button>
    </div>
  )
}
