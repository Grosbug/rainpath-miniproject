import { useCallback, useEffect, useState } from 'react'
import { Icon, IconName } from './Icon'

export type AnchoredToastType = 'error' | 'warning' | 'info'

type AnchoredToast = {
  id: number
  message: string
  type: AnchoredToastType
  x: number
  y: number
}

interface ShowInput {
  message: string
  type?: AnchoredToastType
  x: number
  y: number
  /** Auto-dismiss after this many ms (default 3500). Use Infinity to require manual dismiss. */
  durationMs?: number
}

let dispatch: ((t: ShowInput) => void) | null = null
let nextId = 1

/**
 * Show a small toast bubble anchored at viewport coordinates (x, y). Used for action-local
 * feedback (illegal connection, invalid drop, etc.) so the message appears next to the user's
 * cursor instead of in a fixed corner. The bubble auto-clamps to the visible viewport so it
 * never gets cropped at edges.
 */
export function showAnchoredToast(input: ShowInput) {
  dispatch?.(input)
}

export function AnchoredToasts() {
  const [toasts, setToasts] = useState<AnchoredToast[]>([])

  useEffect(() => {
    dispatch = (t: ShowInput) => {
      const id = nextId++
      const duration = t.durationMs ?? 3500
      setToasts(prev => [...prev, { id, message: t.message, type: t.type ?? 'error', x: t.x, y: t.y }])
      if (Number.isFinite(duration)) {
        window.setTimeout(() => {
          setToasts(prev => prev.filter(x => x.id !== id))
        }, duration)
      }
    }
    return () => { dispatch = null }
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(x => x.id !== id))
  }, [])

  return (
    <div className='pointer-events-none fixed inset-0 z-[9000]' aria-live='polite' aria-atomic='true'>
      {toasts.map(t => <Bubble key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />)}
    </div>
  )
}

const TYPE_STYLE: Record<AnchoredToastType, { bg: string; icon: IconName }> = {
  error:   { bg: 'bg-danger',  icon: 'CircleAlert' },
  warning: { bg: 'bg-warning', icon: 'TriangleAlert' },
  info:    { bg: 'bg-info',    icon: 'Info' }
}

function Bubble({ toast, onDismiss }: { toast: AnchoredToast; onDismiss: () => void }) {
  // Clamp to viewport so the bubble stays fully visible even near edges. The 16px padding
  // is rough breathing room — actual width is content-driven (whitespace-nowrap).
  const padding = 16
  const x = Math.max(padding, Math.min(window.innerWidth - padding, toast.x))
  const y = Math.max(padding + 24, Math.min(window.innerHeight - padding, toast.y))
  const meta = TYPE_STYLE[toast.type]
  return (
    <div
      role='alert'
      onClick={onDismiss}
      data-rp-tooltip='Cliquer pour fermer'
      className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-[calc(100%+12px)] cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-elev-2 ${meta.bg}`}
      style={{ left: x, top: y }}
    >
      <div className='flex items-center gap-2'>
        <Icon name={meta.icon} size={16} />
        <span>{toast.message}</span>
      </div>
      {/* Tail pointing down toward the anchor point */}
      <div
        className={`absolute left-1/2 top-full -translate-x-1/2 h-2 w-2 rotate-45 ${meta.bg}`}
        style={{ marginTop: -4 }}
        aria-hidden='true'
      />
    </div>
  )
}
