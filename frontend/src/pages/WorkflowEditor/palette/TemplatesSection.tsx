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
import { useModalState, useTrackOverlayOpen, type NodeKind } from '../modal-state'
import { NewTemplateButton } from './NewTemplateButton'
import { nodeFamilyAccentColor, nodeFamilyChrome, SEND_KIND_FAMILY } from '../node-family'

type PaletteKind = NodeKind
const PALETTE_KINDS = ['send_email', 'send_sms', 'send_whatsapp', 'send_postal'] as const satisfies readonly PaletteKind[]

const KIND_LABEL: Record<PaletteKind, string> = {
  send_email: 'Email',
  send_sms: 'SMS',
  send_whatsapp: 'WhatsApp',
  send_postal: 'Postal'
}

const KIND_ICON: Record<PaletteKind, IconName> = {
  send_email: 'Mail',
  send_sms: 'MessageSquare',
  send_whatsapp: 'MessageCircle',
  send_postal: 'Inbox'
}

export function TemplatesSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.nodeTemplates.list(),
    queryFn: listNodeTemplates
  })
  const qc = useQueryClient()
  const open = useModalState(s => s.open)
  const [expanded, setExpanded] = useState<string[]>([...PALETTE_KINDS])

  const delMut = useMutation({
    mutationFn: (id: string) => deleteNodeTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodeTemplates.list() })
      toast.success('Modèle supprimé')
    },
    onError: () => toast.error('Échec de la suppression')
  })

  const grouped = useMemo(() => {
    const out: Record<PaletteKind, NodeTemplate[]> = {
      send_email: [], send_sms: [], send_whatsapp: [], send_postal: []
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
        // Carry the template name alongside the params so the drop handler can stamp it
        // into the node's `displayName` — the dropped node will then carry the template
        // identity on its card even after the user edits subject/body.
        name: template.name,
        params: (template as unknown as { params: unknown }).params
      })
    )
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="px-4 pt-3 pb-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Modèles</h3>
        <NewTemplateButton />
      </div>

      {/* Persistent affordance hint — the rows have two distinct interactions (drag to add,
          click to edit) and the cursor swap + grip icon weren't obvious enough on their own.
          Inline so it's always visible without taking much room, and the arrow icon mirrors
          the drag gesture's "move toward canvas" direction. */}
      <div
        className="mb-2 flex items-center gap-2 rounded-md border border-dashed border-border bg-surface-muted/40 px-2 py-1.5 text-[11px] text-fg-muted"
        role="note"
      >
        <Icon name="MousePointerClick" size={16} className="shrink-0" />
        <span className="leading-tight">
          <span className="font-medium text-fg">Glissez</span> un modèle sur le canvas pour l'ajouter,
          ou <span className="font-medium text-fg">cliquez</span> pour l'éditer.
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-fg-muted">Chargement…</p>
      ) : error ? (
        <p className="text-xs text-danger">Impossible de charger les modèles</p>
      ) : (
        <Accordion.Root type="multiple" value={expanded} onValueChange={setExpanded}>
          {PALETTE_KINDS.map(kind => {
            const items = grouped[kind]
            if (items.length === 0) return null
            const family = SEND_KIND_FAMILY[kind]
            const chrome = nodeFamilyChrome(family)
            return (
              <Accordion.Item key={kind} value={kind} className="border-b border-border last:border-0">
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full items-center justify-between py-2 text-xs font-medium text-fg [&[data-state=open]>svg]:rotate-180">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border"
                        style={chrome.card}
                      >
                        <Icon name={KIND_ICON[kind]} size={16} style={{ color: nodeFamilyAccentColor(family) }} />
                      </span>
                      {KIND_LABEL[kind]} <span className="text-fg-muted">({items.length})</span>
                    </span>
                    <Icon name="ChevronDown" size={16} className="transition-transform" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="space-y-1 pb-2">
                  {items.map(t => (
                    <TemplateRow
                      key={t.id}
                      template={t}
                      kindIcon={KIND_ICON[kind]}
                      chrome={chrome}
                      accentColor={nodeFamilyAccentColor(family)}
                      onOpenEdit={() => open({ mode: 'template-edit', template: t })}
                      onDelete={() => delMut.mutate(t.id)}
                      onDragStart={e => onDragStart(e, t)}
                    />
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

function TemplateRow({
  template,
  kindIcon,
  chrome,
  accentColor,
  onOpenEdit,
  onDelete,
  onDragStart
}: {
  template: NodeTemplate
  kindIcon: IconName
  chrome: ReturnType<typeof nodeFamilyChrome>
  accentColor: string
  onOpenEdit: () => void
  onDelete: () => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  useTrackOverlayOpen(menuOpen)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpenEdit}
      data-rp-tooltip="Glisser vers le canvas pour créer le nœud · Clic pour éditer le modèle"
      aria-label={`${template.name} — glisser vers le canvas pour créer un nœud, cliquer pour éditer`}
      // `cursor-grab` at rest (canonical web idiom for "this is draggable") with a swap to
      // `cursor-grabbing` when the user actually presses + drags. The grip + hover lift
      // re-enforce the same signal redundantly.
      className="group relative flex h-10 cursor-grab items-center gap-2 overflow-hidden rounded-md border py-0 pl-3 pr-1 text-sm shadow-elev-1 transition-all hover:-translate-y-[1px] hover:shadow-elev-2 active:cursor-grabbing"
      style={chrome.card}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-md"
        style={chrome.accent}
        aria-hidden="true"
      />
      {/* Grip darkens on hover so the "you can grab here" signal is unmissable. */}
      <Icon name="GripVertical" size={16} className="text-fg-subtle transition-colors group-hover:text-fg-muted" />
      <Icon name={kindIcon} size={16} style={{ color: accentColor }} />
      <span className="min-w-0 flex-1 truncate font-medium text-fg">
        {template.name}
      </span>
      {/* React forwards synthetic events from portalised menu items up through
          the *React* tree, so a click on "Supprimer" would otherwise bubble back
          to the row's onClick and re-open the edit dialog. Stop the bubble at
          the menu boundary. */}
      <div onClick={e => e.stopPropagation()}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownTrigger asChild>
            <IconButton
              icon="EllipsisVertical"
              aria-label={`Actions sur ${template.name}`}
              size="sm"
            />
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem icon="Pencil" onSelect={onOpenEdit}>
              Éditer
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon="Trash2" danger onSelect={onDelete}>
              Supprimer
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
