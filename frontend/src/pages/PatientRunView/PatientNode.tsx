import { Handle, NodeProps, Position } from '@xyflow/react'
import type { Graph } from '@rainpath/shared'
import { Icon, IconName } from '@/components/Icon'

export type ReachabilityState = 'visited' | 'current' | 'reachable' | 'blocked' | 'unreachable'

type NodeData = Graph['nodes'][number]['data']
export type PatientNodeData = NodeData & { reachability: ReachabilityState; blockedReason?: string }

const KIND_META: Record<NodeData['kind'], {
  family: string
  icon: IconName
  label: string
}> = {
  start:         { family: 'start',       icon: 'Play',           label: 'Départ' },
  end:           { family: 'end',         icon: 'Square',         label: 'Fin' },
  send_email:    { family: 'email',       icon: 'Mail',           label: 'Email' },
  send_sms:      { family: 'sms',         icon: 'MessageSquare',  label: 'SMS' },
  send_whatsapp: { family: 'whatsapp',    icon: 'MessageCircle',  label: 'WhatsApp' },
  send_postal:   { family: 'postal',      icon: 'Inbox',          label: 'Courrier' },
  condition:     { family: 'cond-data',   icon: 'GitBranch',      label: 'Condition' }
}

function titleFor(data: NodeData): string {
  switch (data.kind) {
    case 'start': return 'Examen effectué'
    case 'end':   return 'Patient relancé'
    case 'send_email':    return data.params.subject || '(sans sujet)'
    case 'send_sms':      return data.params.body.slice(0, 28) || '(SMS vide)'
    case 'send_whatsapp': return data.params.body.slice(0, 32) || '(message vide)'
    case 'send_postal':   return data.params.body.slice(0, 32) || '(courrier vide)'
    case 'condition':     return data.params.expression || '(expression vide)'
  }
}

const REACH_OUTER: Record<ReachabilityState, string> = {
  visited:     '',
  current:     'animate-pulse',
  reachable:   '',
  blocked:     'opacity-40',
  unreachable: 'pointer-events-none opacity-20 grayscale'
}

export function PatientNode({ data }: NodeProps) {
  const d = data as PatientNodeData
  const meta = KIND_META[d.kind]
  const title = titleFor(d)
  const isCompact = d.kind === 'start' || d.kind === 'end'

  const cardStyle = {
    backgroundColor: `var(--node-${meta.family}-bg)`,
    borderColor:
      d.reachability === 'current' ? 'var(--primary)' :
      d.reachability === 'visited' ? 'var(--success)' :
      d.reachability === 'blocked' ? 'var(--danger)' :
      `var(--node-${meta.family}-border)`,
    borderStyle: d.reachability === 'blocked' ? 'dashed' : 'solid',
    borderWidth: d.reachability === 'current' ? 2 : 1
  } as const

  const stripStyle = { background: `var(--node-${meta.family}-accent)` } as const

  return (
    <div className={REACH_OUTER[d.reachability]}>
      <div
        className={`relative rounded-md p-3 shadow-elev-1 ${isCompact ? 'w-[180px]' : 'w-[260px]'}`}
        style={cardStyle}
      >
        <div className="absolute left-0 top-0 h-full w-[3px] rounded-l-md" style={stripStyle} aria-hidden="true" />
        <div className="ml-1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
            <Icon name={meta.icon} size={16} />
            <span>{meta.label}</span>
          </div>
          <ReachabilityBadge state={d.reachability} blockedReason={d.blockedReason} />
        </div>
        <h3 className="mt-1 ml-1 text-sm font-semibold text-fg">
          <span className="line-clamp-1">{title}</span>
        </h3>

        {d.kind !== 'start' && (
          <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !bg-surface" />
        )}
        {d.kind !== 'end' && (
          <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !bg-surface" />
        )}
      </div>
    </div>
  )
}

function ReachabilityBadge({ state, blockedReason }: { state: ReachabilityState; blockedReason?: string }) {
  if (state === 'visited') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] font-semibold text-success"
        aria-label="Étape terminée"
      >
        <Icon name="Check" size={16} />
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary"
        aria-current="step"
      >
        En cours
      </span>
    )
  }
  if (state === 'blocked') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-semibold text-danger"
        title={blockedReason}
      >
        Bloqué
      </span>
    )
  }
  return null
}
