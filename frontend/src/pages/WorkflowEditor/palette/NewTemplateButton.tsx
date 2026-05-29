import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Icon, IconName } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { useModalState, type NodeKind } from '../modal-state'
import { nodeFamilyAccentColor, nodeFamilyChrome, SEND_KIND_FAMILY } from '../node-family'

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
          {OPTIONS.map(o => {
            const family = SEND_KIND_FAMILY[o.kind]
            const chrome = nodeFamilyChrome(family)
            return (
              <button
                key={o.kind}
                type="button"
                onClick={() => {
                  openModal({ mode: 'template-create', kind: o.kind })
                  setOpen(false)
                }}
                className="relative flex w-full items-center gap-2 overflow-hidden rounded-md border px-2 py-1.5 text-sm text-fg outline-none hover:brightness-[0.98]"
                style={chrome.card}
              >
                <div
                  className="absolute left-0 top-0 h-full w-[3px] rounded-l-md"
                  style={chrome.accent}
                  aria-hidden="true"
                />
                <Icon name={o.icon} size={16} style={{ color: nodeFamilyAccentColor(family) }} />
                {o.label}
              </button>
            )
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
