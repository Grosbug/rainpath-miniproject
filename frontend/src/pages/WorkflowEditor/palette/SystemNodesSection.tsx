import { DragEvent } from 'react'
import { Icon } from '@/components/Icon'
import { useEditorStore } from '../store'

interface PaletteDragPayload {
  kind: 'start' | 'end' | 'template'
  templateId?: string
}

function startDrag(e: DragEvent<HTMLButtonElement>, payload: PaletteDragPayload) {
  e.dataTransfer.setData('application/x-rainpath-palette', JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

export function SystemNodesSection() {
  const hasStart = useEditorStore(s => s.nodes.some(n => n.data.kind === 'start'))
  return (
    <div className="px-4 pt-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Nœuds système
      </h3>
      <div className="space-y-1">
        <button
          type="button"
          draggable={!hasStart}
          onDragStart={e => startDrag(e, { kind: 'start' })}
          aria-disabled={hasStart}
          className={`flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm transition-colors ${
            hasStart
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-grab hover:bg-surface-muted active:cursor-grabbing'
          }`}
          title={hasStart ? 'Un nœud Départ existe déjà' : 'Glisser pour ajouter'}
        >
          <Icon name="Play" size={16} className="text-[var(--node-start-accent)]" />
          <span className="font-medium text-fg">Départ</span>
        </button>
        <button
          type="button"
          draggable
          onDragStart={e => startDrag(e, { kind: 'end' })}
          className="flex h-10 w-full cursor-grab items-center gap-2 rounded-md px-3 text-sm hover:bg-surface-muted active:cursor-grabbing"
        >
          <Icon name="Square" size={16} className="text-[var(--node-end-accent)]" />
          <span className="font-medium text-fg">Fin</span>
        </button>
      </div>
    </div>
  )
}
