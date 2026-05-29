import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'
import { SendNodeSourceHandles } from './SendNodeSourceHandles'
import type { Graph } from '@rainpath/shared'

type EmailNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'send_email' }>

export function SendEmailNode({ data, selected }: NodeProps) {
  const d = data as EmailNodeData & { _dayX?: number; _errorCount?: number; _warningCount?: number }
  return (
    <NodeCard
      family="email"
      icon="Mail"
      familyLabel="Email"
      title={d.params.subject || '(sans sujet)'}
      details={
        <p className="line-clamp-1">{d.params.body || '(corps vide)'}</p>
      }
      selected={!!selected}
      dayX={d._dayX}
      errorCount={d._errorCount}
      warningCount={d._warningCount}
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={`${handleClass} border-[var(--node-email-accent)]`}
          />
          <SendNodeSourceHandles output={d.params.output} />
        </>
      }
    />
  )
}
