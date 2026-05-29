import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'
import { SendNodeSourceHandles } from './SendNodeSourceHandles'
import type { Graph } from '@rainpath/shared'
import { CHANNEL_FORMAT_RULES } from '@rainpath/shared'

type SmsNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'send_sms' }>

export function SendSmsNode({ data, selected }: NodeProps) {
  const d = data as SmsNodeData & { _dayX?: number }
  const len = d.params.body.length
  const rec = CHANNEL_FORMAT_RULES.sms.body.recommendedMax
  const max = CHANNEL_FORMAT_RULES.sms.body.maxLength
  const counterClass =
    len > max ? 'text-danger' : len > rec ? 'text-warning' : 'text-fg-muted'
  return (
    <NodeCard
      family="sms"
      icon="MessageSquare"
      familyLabel="SMS"
      title={d.params.body.slice(0, 28) || '(SMS vide)'}
      details={
        <p className={`tabular-nums ${counterClass}`}>{len} / {rec}</p>
      }
      selected={!!selected}
      dayX={d._dayX}
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={`${handleClass} border-[var(--node-sms-accent)]`}
          />
          <SendNodeSourceHandles output={d.params.output} />
        </>
      }
    />
  )
}
