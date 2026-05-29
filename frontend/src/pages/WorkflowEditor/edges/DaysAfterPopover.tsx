import { useEffect, useRef } from 'react'
import { Icon } from '@/components/Icon'

interface Props {
  open: boolean
  /** Left/right edges and vertical center of the edge label chip (viewport coords). */
  anchor: { left: number; right: number; y: number } | null
  onDismiss: () => void
  onDelete: () => void
}

const actionBtnClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface shadow-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Edge chip actions — cancel on the left and delete on the right. Pinned on click;
 * dismissed on Escape, outside-click, or the cancel button.
 */
export function DaysAfterPopover({ open, anchor, onDismiss, onDelete }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onDismiss])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement
      if (ref.current?.contains(target)) return
      if (target.closest('[data-edge-label-id]')) return
      onDismiss()
    }
    const raf = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', onPointerDown, true)
    })
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [open, onDismiss])

  if (!open || !anchor) return null

  return (
    <div ref={ref} role='dialog' data-edge-actions>
      <div
        style={{
          position: 'fixed',
          left: anchor.left,
          top: anchor.y,
          transform: 'translate(calc(-100% - 2px), -50%)'
        }}
        className='z-50'
      >
        <button
          type='button'
          onClick={onDismiss}
          aria-label='Annuler'
          data-rp-tooltip='Annuler'
          className={`${actionBtnClass} text-fg hover:bg-surface-muted`}
        >
          <Icon name='X' size={16} />
        </button>
      </div>
      <div
        style={{
          position: 'fixed',
          left: anchor.right,
          top: anchor.y,
          transform: 'translate(2px, -50%)'
        }}
        className='z-50'
      >
        <button
          type='button'
          onClick={onDelete}
          aria-label='Supprimer la connexion'
          data-rp-tooltip='Supprimer la connexion'
          className={`${actionBtnClass} text-danger hover:bg-[#FEF2F2] focus-visible:ring-danger`}
        >
          <Icon name='Trash2' size={16} />
        </button>
      </div>
    </div>
  )
}
