import { DragEvent, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Accordion from '@radix-ui/react-accordion'
import { toast } from 'sonner'
import type { NodeTemplate } from '@rainpath/shared'
import { Icon, IconName } from '@/components/Icon'
import { IconButton } from '@/components/ui/IconButton'
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { queryKeys } from '@/api/query-keys'
import { listNodeTemplates, deleteNodeTemplate } from '@/api/node-templates'
import { useModalState, type NodeKind } from '../modal-state'
import { NewTemplateButton } from './NewTemplateButton'

const KIND_LABEL: Record<NodeKind, string> = {
  send_email: 'Email',
  send_sms: 'SMS',
  send_whatsapp: 'WhatsApp',
  send_postal: 'Postal',
  condition: 'Condition'
}

const KIND_ICON: Record<NodeKind, IconName> = {
  send_email: 'Mail',
  send_sms: 'MessageSquare',
  send_whatsapp: 'MessageCircle',
  send_postal: 'Inbox',
  condition: 'GitBranch'
}

export function TemplatesSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.nodeTemplates.list(),
    queryFn: listNodeTemplates
  })
  const qc = useQueryClient()
  const open = useModalState(s => s.open)
  const [expanded, setExpanded] = useState<string[]>(['send_email', 'send_sms', 'send_whatsapp', 'send_postal', 'condition'])

  const delMut = useMutation({
    mutationFn: (id: string) => deleteNodeTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodeTemplates.list() })
      toast.success('Modèle supprimé')
    },
    onError: () => toast.error('Échec de la suppression')
  })

  const grouped = useMemo(() => {
    const out: Record<NodeKind, NodeTemplate[]> = {
      send_email: [], send_sms: [], send_whatsapp: [], send_postal: [], condition: []
    }
    if (!data) return out
    for (const t of data) {
      const k = (t as unknown as { kind: NodeKind }).kind
      out[k]?.push(t)
    }
    return out
  }, [data])

  const onDragStart = (e: DragEvent<HTMLDivElement>, template: NodeTemplate) => {
    e.dataTransfer.setData(
      'application/x-rainpath-palette',
      JSON.stringify({ kind: 'template', templateId: template.id })
    )
    e.dataTransfer.setData(
      'application/x-rainpath-template',
      JSON.stringify({
        kind: (template as unknown as { kind: NodeKind }).kind,
        params: (template as unknown as { params: unknown }).params
      })
    )
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="border-t border-border px-4 pt-3 pb-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Modèles</h3>
        <NewTemplateButton />
      </div>

      {isLoading ? (
        <p className="text-xs text-fg-muted">Chargement…</p>
      ) : error ? (
        <p className="text-xs text-danger">Impossible de charger les modèles</p>
      ) : (
        <Accordion.Root type="multiple" value={expanded} onValueChange={setExpanded}>
          {(Object.keys(grouped) as NodeKind[]).map(kind => {
            const items = grouped[kind]
            if (items.length === 0) return null
            return (
              <Accordion.Item key={kind} value={kind} className="border-b border-border last:border-0">
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full items-center justify-between py-2 text-xs font-medium text-fg [&[data-state=open]>svg]:rotate-180">
                    <span className="flex items-center gap-2">
                      <Icon name={KIND_ICON[kind]} size={16} />
                      {KIND_LABEL[kind]} <span className="text-fg-muted">({items.length})</span>
                    </span>
                    <Icon name="ChevronDown" size={16} className="transition-transform" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="pb-2">
                  {items.map(t => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={e => onDragStart(e, t)}
                      className="group flex h-10 cursor-grab items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-muted active:cursor-grabbing"
                    >
                      <Icon name="GripVertical" size={16} className="text-fg-subtle" />
                      <span className="flex-1 truncate font-medium text-fg" title={t.name}>
                        {t.name}
                      </span>
                      <DropdownMenu>
                        <DropdownTrigger asChild>
                          <IconButton
                            icon="EllipsisVertical"
                            aria-label={`Actions sur ${t.name}`}
                            size="sm"
                          />
                        </DropdownTrigger>
                        <DropdownContent>
                          <DropdownItem icon="Pencil" onSelect={() => open({ mode: 'template-edit', template: t })}>
                            Éditer
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem icon="Trash2" danger onSelect={() => delMut.mutate(t.id)}>
                            Supprimer
                          </DropdownItem>
                        </DropdownContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </Accordion.Content>
              </Accordion.Item>
            )
          })}
        </Accordion.Root>
      )}
    </div>
  )
}
