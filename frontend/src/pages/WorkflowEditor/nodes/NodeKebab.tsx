import { MouseEvent, useState } from 'react'
import { Icon } from '@/components/Icon'
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { useEditorStore } from '../store'
import { useModalState, useTrackOverlayOpen, type NodeKind } from '../modal-state'

interface NodeKebabProps {
  nodeId: string
  kind: NodeKind
}

/**
 * Round actions button anchored to the bottom-center of a send_* NodeCard, half-overlapping
 * the card edge. Subtle at rest (opacity-0) and lit on group-hover or when the wrapping card
 * carries the React Flow `selected` data flag — keeps the chrome quiet until the user reaches
 * for it. The trigger lives inside the card's relative box so the dropdown anchors correctly.
 */
export function NodeKebab({ nodeId, kind }: NodeKebabProps) {
  const removeNode = useEditorStore(s => s.removeNode)
  const openModal = useModalState(s => s.open)
  const [open, setOpen] = useState(false)
  useTrackOverlayOpen(open)

  // Stop React Flow from interpreting the click as a node-drag / selection-toggle.
  const stop = (e: MouseEvent) => e.stopPropagation()

  return (
    <div
      className='absolute left-1/2 bottom-0 z-10 -translate-x-1/2 translate-y-1/2
                 opacity-0 transition-opacity
                 group-hover/nodecard:opacity-100
                 group-data-[selected=true]/nodecard:opacity-100
                 focus-within:opacity-100
                 has-[[data-state=open]]:opacity-100'
      onMouseDown={stop}
      onClick={stop}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownTrigger asChild>
          <button
            type='button'
            aria-label='Actions sur le nœud'
            data-rp-tooltip='Actions'
            className='inline-flex h-7 w-7 items-center justify-center rounded-full
                       border border-border bg-surface text-fg shadow-elev-1
                       hover:bg-surface-muted
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                       data-[state=open]:bg-surface-muted'
            onMouseDown={stop}
            onClick={stop}
          >
            <Icon name='EllipsisVertical' size={16} />
          </button>
        </DropdownTrigger>
        <DropdownContent align='center' side='bottom' sideOffset={6}>
          <DropdownItem
            icon='Pencil'
            onSelect={() => openModal({ mode: 'node-edit', nodeId, kind })}
          >
            Éditer
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon='Trash2' danger onSelect={() => removeNode(nodeId)}>
            Supprimer
          </DropdownItem>
        </DropdownContent>
      </DropdownMenu>
    </div>
  )
}
