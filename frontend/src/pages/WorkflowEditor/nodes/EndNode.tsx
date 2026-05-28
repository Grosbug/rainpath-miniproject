import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'

export function EndNode({ selected }: NodeProps) {
  return (
    <NodeCard
      family="end"
      icon="Square"
      familyLabel="Fin"
      title="Patient relancé"
      width={180}
      thickBorder
      selected={!!selected}
      handles={
        <Handle
          type="target"
          position={Position.Left}
          className={`${handleClass} border-[var(--node-end-accent)]`}
        />
      }
    />
  )
}
