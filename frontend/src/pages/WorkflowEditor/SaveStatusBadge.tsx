import { useEditorStore } from './store'
import { Icon } from '@/components/Icon'
import { relativeFromNow } from '@/lib/format-date'

export function SaveStatusBadge() {
  const status = useEditorStore(s => s.saveStatus)
  const savedAt = useEditorStore(s => s.lastSavedAt)

  const map: Record<typeof status, { label: string; icon: 'CircleCheck' | 'LoaderCircle' | 'WifiOff' | 'CircleAlert'; tone: string }> = {
    idle: { label: 'Modifications non enregistrées', icon: 'CircleCheck', tone: 'text-fg-muted' },
    saving: { label: 'Enregistrement…', icon: 'LoaderCircle', tone: 'text-fg-muted' },
    saved: {
      label: savedAt ? `Enregistré ${relativeFromNow(savedAt)}` : 'Enregistré',
      icon: 'CircleCheck',
      tone: 'text-success'
    },
    invalid: { label: 'Erreur de validation', icon: 'CircleAlert', tone: 'text-warning' },
    error: { label: 'Erreur d\'enregistrement', icon: 'CircleAlert', tone: 'text-danger' },
    offline: { label: 'Hors-ligne', icon: 'WifiOff', tone: 'text-warning' }
  }
  const item = map[status]

  return (
    <div
      className={`flex min-w-[260px] items-center justify-center gap-2 text-sm ${item.tone}`}
      aria-live='polite'
    >
      <Icon name={item.icon} size={16} className={status === 'saving' ? 'animate-spin' : ''} />
      <span>{item.label}</span>
    </div>
  )
}
