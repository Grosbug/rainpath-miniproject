import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Icon, IconName } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { useModalState, type NodeKind } from '../modal-state'

const OPTIONS: Array<{ kind: NodeKind; label: string; icon: IconName }> = [
  { kind: 'send_email', label: 'Email', icon: 'Mail' },
  { kind: 'send_sms', label: 'SMS', icon: 'MessageSquare' },
  { kind: 'send_whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
  { kind: 'send_postal', label: 'Courrier', icon: 'Inbox' }
]

export function NewTemplateButton() {
  const [open, setOpen] = useState(false)
  const openModal = useModalState(s => s.open)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="primary" size="sm">
          <Icon name="Plus" size={16} />
          Nouveau
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={4}
          className="z-50 min-w-[200px] rounded-md border border-border bg-surface p-1 shadow-elev-2"
        >
          {OPTIONS.map(o => (
            <button
              key={o.kind}
              type="button"
              onClick={() => {
                openModal({ mode: 'template-create', kind: o.kind })
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-fg outline-none hover:bg-surface-muted"
            >
              <Icon name={o.icon} size={16} />
              {o.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
