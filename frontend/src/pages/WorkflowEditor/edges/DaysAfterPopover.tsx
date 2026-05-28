import { useEffect, useRef, useState } from 'react'
import {
  autoUpdate, flip, offset, shift, useFloating, useDismiss, useInteractions
} from '@floating-ui/react'

interface Props {
  open: boolean
  anchor: { x: number; y: number } | null
  initialValue: number
  onCommit: (value: number) => void
  onCancel: () => void
}

/**
 * Anchored to a {clientX, clientY} point because we don't have a stable DOM element
 * for the edge midpoint — React Flow renders edges as raw SVG paths.
 */
export function DaysAfterPopover({ open, anchor, initialValue, onCommit, onCancel }: Props) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Re-sync when re-opened.
  useEffect(() => {
    if (open) {
      setValue(initialValue)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open, initialValue])

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: o => { if (!o) onCancel() },
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate
  })

  // Position via a virtual reference element built from the anchor point.
  useEffect(() => {
    if (!anchor) return
    refs.setPositionReference({
      getBoundingClientRect: () => ({
        x: anchor.x, y: anchor.y, top: anchor.y, left: anchor.x,
        right: anchor.x, bottom: anchor.y, width: 0, height: 0
      })
    })
  }, [anchor, refs])

  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true })
  const { getFloatingProps } = useInteractions([dismiss])

  if (!open || !anchor) return null

  return (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      {...getFloatingProps()}
      className='z-50 rounded-md border border-border bg-surface p-3 shadow-elev-2'
    >
      <form
        onSubmit={e => {
          e.preventDefault()
          if (Number.isFinite(value) && value >= 0 && Number.isInteger(value)) onCommit(value)
        }}
        className='flex items-center gap-2'
      >
        <label htmlFor='days-after' className='text-xs font-medium text-fg-muted'>
          Délai (jours)
        </label>
        <input
          id='days-after'
          ref={inputRef}
          type='number'
          min={0}
          step={1}
          value={value}
          onChange={e => setValue(Number(e.target.value))}
          className='h-8 w-20 rounded-md border border-border bg-surface px-2 text-sm tabular-nums focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        />
        <button
          type='submit'
          className='h-8 rounded-md bg-primary px-3 text-xs font-medium text-on-primary hover:bg-primary-hover'
        >
          Valider
        </button>
      </form>
    </div>
  )
}
