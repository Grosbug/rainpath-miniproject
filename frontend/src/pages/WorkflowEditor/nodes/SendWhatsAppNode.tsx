import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { NodeKebab } from './NodeKebab'
import { handleClass } from './handle-styles'
import { SendNodeSourceHandles } from './SendNodeSourceHandles'
import type { Graph } from '@rainpath/shared'
import { nodeDisplayTitle } from '@rainpath/shared'

type WhatsAppNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'send_whatsapp' }>

export function SendWhatsAppNode({ id, data, selected }: NodeProps) {
  const d = data as WhatsAppNodeData & { _dayX?: number; _errorCount?: number; _warningCount?: number }
  return (
    <NodeCard
      family="whatsapp"
      icon="MessageCircle"
      familyLabel="WhatsApp"
      title={nodeDisplayTitle(d)}
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
            className={`${handleClass} border-[var(--node-whatsapp-accent)]`}
          />
          <SendNodeSourceHandles output={d.params.output} />
        </>
      }
      actions={<NodeKebab nodeId={id} kind="send_whatsapp" />}
    />
  )
}
