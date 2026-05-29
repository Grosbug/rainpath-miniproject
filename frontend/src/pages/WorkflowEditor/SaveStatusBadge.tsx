import { useEffect, useState } from 'react'
import { useEditorStore } from './store'
import { Icon } from '@/components/Icon'
import { relativeFromNow } from '@/lib/format-date'

/**
 * After this many ms in a transient state (invalid / saved_invalid), the badge
 * auto-decays to the steady-state equivalent ('saved' if a hash exists, else 'idle')
 * so the alarming "Erreur de validation" doesn't linger on screen forever. The
 * underlying invalid state is still visible via the inline node badges and the
 * "create patient run" guard.
 */
const INVALID_AUTO_DISMISS_MS = 6000

/** Tooltip refresh cadence so the relative "il y a X min" stays fresh between saves. */
const TOOLTIP_REFRESH_MS = 30_000

export function SaveStatusBadge() {
  const status = useEditorStore(s => s.saveStatus)
  const savedAt = useEditorStore(s => s.lastSavedAt)
  const lastSavedHash = useEditorStore(s => s.lastSavedSnapshotHash)
  const setSaveStatus = useEditorStore(s => s.setSaveStatus)

  useEffect(() => {
    if (status !== 'invalid' && status !== 'saved_invalid') return
    const timer = setTimeout(() => {
      setSaveStatus(lastSavedHash ? 'saved' : 'idle')
    }, INVALID_AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [status, lastSavedHash, setSaveStatus])

  // Bump a tick every 30s so the tooltip's relative time is recomputed on the next hover.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (status !== 'saved' && status !== 'saved_invalid') return
    const id = setInterval(() => setTick(t => t + 1), TOOLTIP_REFRESH_MS)
    return () => clearInterval(id)
  }, [status])

  const map: Record<typeof status, { label: string; icon: 'CircleCheck' | 'LoaderCircle' | 'WifiOff' | 'CircleAlert' | 'TriangleAlert' | 'Circle'; tone: string }> = {
    idle: { label: 'Modifications non enregistrées', icon: 'Circle', tone: 'text-fg-muted' },
    saving: { label: 'Enregistrement…', icon: 'LoaderCircle', tone: 'text-fg-muted' },
    saved: {
      label: savedAt ? `Enregistré ${relativeFromNow(savedAt)}` : 'Enregistré',
      icon: 'CircleCheck',
      tone: 'text-success'
    },
    saved_invalid: {
      label: savedAt
        ? `Enregistré ${relativeFromNow(savedAt)} · erreurs de validation`
        : 'Enregistré avec erreurs de validation',
      icon: 'TriangleAlert',
      tone: 'text-warning'
    },
    invalid: { label: 'Erreur de validation', icon: 'CircleAlert', tone: 'text-warning' },
    error: { label: 'Erreur d\'enregistrement', icon: 'CircleAlert', tone: 'text-danger' },
    offline: { label: 'Hors-ligne', icon: 'WifiOff', tone: 'text-warning' }
  }
  const item = map[status]

  return (
    <div
      className={`flex items-center justify-center ${item.tone}`}
      aria-live='polite'
      aria-label={item.label}
      data-rp-tooltip={item.label}
    >
      <Icon name={item.icon} size={16} className={status === 'saving' ? 'animate-spin' : ''} />
    </div>
  )
}
