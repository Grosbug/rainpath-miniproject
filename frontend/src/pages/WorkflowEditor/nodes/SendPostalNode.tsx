import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'
import { SendNodeSourceHandles } from './SendNodeSourceHandles'
import type { Graph } from '@rainpath/shared'

type PostalNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'send_postal' }>

export function SendPostalNode({ data, selected }: NodeProps) {
  const d = data as PostalNodeData & { _dayX?: number }
  return (
    <NodeCard
      family="postal"
      icon="Inbox"
      familyLabel="Courrier postal"
      title={d.params.body.slice(0, 32) || '(courrier vide)'}
      details={
        <p className="line-clamp-1">
          {d.params.tracked ? 'Suivi · ' : 'Non suivi · '}
          {d.params.body || '(corps vide)'}
        </p>
      }
      selected={!!selected}
      dayX={d._dayX}
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={`${handleClass} border-[var(--node-postal-accent)]`}
          />
          <SendNodeSourceHandles output={d.params.output} />
        </>
      }
    />
  )
}
