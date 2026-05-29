import { useEffect, useRef } from 'react'
import { Icon } from '@/components/Icon'

interface Props {
  open: boolean
  /** Right-center of the edge label chip in viewport coords — popover sits just to its right. */
  anchor: { x: number; y: number } | null
  onHoverStay: () => void
  onHoverEnd: () => void
  onDelete: () => void
}

/**
 * Compact delete control for an edge chip — a single trash button sized to its content.
 * Shown on edge/label hover; stays open while the pointer is over the label or this control.
 */
export function DaysAfterPopover({ open, anchor, onHoverStay, onHoverEnd, onDelete }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onHoverEnd()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onHoverEnd])

  if (!open || !anchor) return null

  return (
    <div
      ref={ref}
      role='dialog'
      onMouseEnter={onHoverStay}
      onMouseLeave={onHoverEnd}
      style={{
        position: 'fixed',
        left: anchor.x,
        top: anchor.y,
        transform: 'translate(6px, -50%)'
      }}
      className='z-50'
      data-edge-delete
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
