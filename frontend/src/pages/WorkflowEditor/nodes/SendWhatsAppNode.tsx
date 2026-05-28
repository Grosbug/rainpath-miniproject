import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'
import type { Graph } from '@rainpath/shared'

type WhatsAppNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'send_whatsapp' }>

export function SendWhatsAppNode({ data, selected }: NodeProps) {
  const d = data as WhatsAppNodeData
  return (
    <NodeCard
      family="whatsapp"
      icon="MessageCircle"
      familyLabel="WhatsApp"
      title={d.params.body.slice(0, 32) || '(message vide)'}
      details={
        <p className="line-clamp-1">{d.params.body || '(corps vide)'}</p>
      }
      selected={!!selected}
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={`${handleClass} border-[var(--node-whatsapp-accent)]`}
          />
          <Handle
            type="source"
            position={Position.Right}
            className={`${handleClass} border-[var(--node-whatsapp-accent)]`}
          />
        </>
      }
    />
  )
}
