import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'

export function EndNode({ data, selected }: NodeProps) {
  const dayX = (data as { _dayX?: number })._dayX
  return (
    <NodeCard
      family="end"
      icon="Square"
      familyLabel="Fin"
      title="Patient relancé"
      thickBorder
      selected={!!selected}
      dayX={dayX}
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
