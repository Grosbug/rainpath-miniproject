import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard, NodeFamily } from './NodeCard'
import { handleClass } from './handle-styles'
import type { Graph } from '@rainpath/shared'

type ConditionNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'condition' }>

const HUMAN_EXPRESSIONS: Record<string, string> = {
  'patient.email': 'Email connu ?',
  'patient.phone': 'Téléphone connu ?',
  'patient.whatsapp': 'WhatsApp connu ?',
  'patient.address': 'Adresse connue ?'
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionNodeData
  const family: NodeFamily = d.params.conditionType === 'data_available' ? 'cond-data' : 'cond-result'
  const accentVar =
    d.params.conditionType === 'data_available' ? 'var(--node-cond-data-accent)' : 'var(--node-cond-result-accent)'
  const title =
    d.params.conditionType === 'data_available'
      ? HUMAN_EXPRESSIONS[d.params.expression] ?? d.params.expression
      : d.params.expression || '(expression vide)'
  return (
    <NodeCard
      family={family}
      icon="GitBranch"
      familyLabel={d.params.conditionType === 'data_available' ? 'Condition · donnée' : 'Condition · résultat'}
      title={title}
      selected={!!selected}
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={`${handleClass}`}
            style={{ borderColor: accentVar }}
          />
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            className={`${handleClass}`}
            style={{ borderColor: 'var(--success)', top: '40%' }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            className={`${handleClass}`}
            style={{ borderColor: 'var(--danger)', top: '70%' }}
          />
        </>
      }
    />
  )
}
