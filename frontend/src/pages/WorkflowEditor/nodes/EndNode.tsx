import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'

export function EndNode({ data, selected }: NodeProps) {
  const d = data as { _dayX?: number; _errorCount?: number; _warningCount?: number }
  return (
    <NodeCard
      family="end"
      icon="Square"
      familyLabel="Fin"
      title="Patient relancé"
      thickBorder
      selected={!!selected}
      dayX={d._dayX}
      errorCount={d._errorCount}
      warningCount={d._warningCount}
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
