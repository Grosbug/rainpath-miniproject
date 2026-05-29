import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
let clearAll: (() => void) | null = null
let nextId = 1

/**
 * Show a small pill toast anchored at viewport coordinates (x, y). Used for action-local
 * feedback (illegal connection, invalid drop, etc.) so the message appears next to the user's
 * cursor instead of in a fixed corner. The pill auto-clamps to the visible viewport so it
 * never gets cropped at edges.
 */
export function showAnchoredToast(input: ShowInput) {
  dispatch?.(input)
}

export function AnchoredToasts() {
  const [toasts, setToasts] = useState<AnchoredToast[]>([])
  const location = useLocation()

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
    clearAll = () => setToasts([])
    return () => {
      dispatch = null
      clearAll = null
    }
  }, [])

  // Anchored toasts are positioned in viewport coords and reference UI from the previous
  // route — leaving them up after a navigation would float orphaned pills over an unrelated
  // page. Clear on every pathname change.
  useEffect(() => {
    clearAll?.()
  }, [location.pathname])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(x => x.id !== id))
  }, [])

  return (
    <div className='pointer-events-none fixed inset-0 z-[9000]' aria-live='polite' aria-atomic='true'>
      {toasts.map(t => <Pill key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />)}
    </div>
  )
}

const TYPE_STYLE: Record<AnchoredToastType, { bg: string; icon: IconName }> = {
  error:   { bg: 'bg-danger',  icon: 'CircleAlert' },
  warning: { bg: 'bg-warning', icon: 'TriangleAlert' },
  info:    { bg: 'bg-info',    icon: 'Info' }
}

function Pill({ toast, onDismiss }: { toast: AnchoredToast; onDismiss: () => void }) {
  // Clamp to viewport so the pill stays fully visible even near edges. The 16px padding
  // is rough breathing room — actual width is content-driven (whitespace-nowrap).
  const padding = 16
  const x = Math.max(padding, Math.min(window.innerWidth - padding, toast.x))
  const y = Math.max(padding + 24, Math.min(window.innerHeight - padding, toast.y))
  const meta = TYPE_STYLE[toast.type]
  // Flip below the anchor when it sits in the top third — rendering above would clip
  // against the viewport edge for anchors near the header.
  const below = toast.y < window.innerHeight / 3
  const translateY = below ? 'translate-y-3' : '-translate-y-[calc(100%+12px)]'
  return (
    <div
      role='alert'
      onClick={onDismiss}
      data-rp-tooltip='Cliquer pour fermer'
      className={`pointer-events-auto absolute -translate-x-1/2 ${translateY} cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium text-white shadow-elev-2 ${meta.bg}`}
      style={{ left: x, top: y }}
    >
      <div className='flex items-center gap-2'>
        <Icon name={meta.icon} size={16} />
        <span>{toast.message}</span>
      </div>
    </div>
  )
}
