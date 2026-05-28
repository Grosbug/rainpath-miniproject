import { Handle, NodeProps, Position } from '@xyflow/react'
import { Icon } from '@/components/Icon'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'

export function StartNode({ selected }: NodeProps) {
  return (
    <div className="relative">
      <NodeCard
        family="start"
        icon="Play"
        familyLabel="Départ"
        title="Examen effectué"
        width={180}
        selected={!!selected}
        handles={
          <Handle
            type="source"
            position={Position.Right}
            className={`${handleClass} border-[var(--node-start-accent)]`}
          />
        }
      />
      <div
        className="absolute bottom-1 right-1 text-fg-muted"
        aria-label="Nœud ancré au début de l'axe temporel"
      >
        <Icon name="Anchor" size={16} />
      </div>
    </div>
  )
}
