import { Handle, NodeProps, Position } from '@xyflow/react'
import type { Graph, OutputConfig } from '@rainpath/shared'
import { Icon, IconName } from '@/components/Icon'

/** Read-only mirror of the editor's handle styling — smaller, no hover/interaction. */
const readOnlyHandleClass = '!h-2 !w-2 !border-2 !bg-surface pointer-events-none'

export type ReachabilityState = 'visited' | 'current' | 'reachable' | 'blocked' | 'unreachable'

type NodeData = Graph['nodes'][number]['data']
export type PatientNodeData = NodeData & {
  reachability: ReachabilityState
  blockedReason?: string
  /** Cumulative delay from start in days (J+N badge top-right). */
  _dayX?: number
}

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
  send_postal:   { family: 'postal',      icon: 'Inbox',          label: 'Courrier' }
}

function titleFor(data: NodeData): string {
  switch (data.kind) {
    case 'start': return 'Examen effectué'
    case 'end':   return 'Patient relancé'
    case 'send_email':    return data.params.subject || '(sans sujet)'
    case 'send_sms':      return data.params.body.slice(0, 28) || '(SMS vide)'
    case 'send_whatsapp': return data.params.body.slice(0, 32) || '(message vide)'
    case 'send_postal':   return data.params.body.slice(0, 32) || '(courrier vide)'
  }
}

/**
 * Outer wrapper class per reachability state. Tuned so non-active nodes stay
 * readable (50% opacity, no grayscale) — the previous 20% + grayscale was
 * almost invisible and made fresh runs look broken.
 */
const REACH_OUTER: Record<ReachabilityState, string> = {
  visited:     '',
  current:     'animate-pulse',
  reachable:   '',
  blocked:     'opacity-80',
  unreachable: 'opacity-75'
}

export function PatientNode({ data }: NodeProps) {
  const d = data as PatientNodeData
  const meta = KIND_META[d.kind]
  const title = titleFor(d)

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
  const ring = d.reachability === 'current'
    ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg shadow-elev-2'
    : 'shadow-elev-1'
  const paddingRight = d._dayX !== undefined ? 'pr-12' : 'pr-3'

  return (
    <div className={REACH_OUTER[d.reachability]}>
      <div
        className={`relative w-[176px] ${ring} rounded-md py-3 pl-[15px] ${paddingRight}`}
        style={cardStyle}
      >
        <div className="absolute left-0 top-0 h-full w-[3px] rounded-l-md" style={stripStyle} aria-hidden="true" />

        {d._dayX !== undefined && (
          <span
            className="absolute right-2 top-2 rounded-full border bg-surface px-2 py-0.5 text-[10px] font-semibold tabular-nums leading-none shadow-elev-1"
            style={{ color: `var(--node-${meta.family}-accent)`, borderColor: `var(--node-${meta.family}-border)` }}
            aria-label={`Délai cumulé depuis le départ : ${d._dayX} jour${d._dayX > 1 ? 's' : ''}`}
            data-rp-tooltip="Délai cumulé depuis le départ"
          >
            J+{d._dayX}
          </span>
        )}

        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
          <Icon name={meta.icon} size={16} className="shrink-0" />
          <span className="truncate">{meta.label}</span>
        </div>
        <h3 className="mt-1 text-sm font-semibold text-fg" data-rp-tooltip={title}>
          <span className="line-clamp-1">{title}</span>
        </h3>
        <div className="mt-2">
          <ReachabilityBadge state={d.reachability} blockedReason={d.blockedReason} />
        </div>

        {d.kind !== 'start' && (
          <Handle type="target" position={Position.Left} className={readOnlyHandleClass} />
        )}
        {d.kind !== 'end' && <SourceHandles data={d} />}
      </div>
    </div>
  )
}

function SourceHandles({ data }: { data: PatientNodeData }) {
  if (
    data.kind === 'send_email' ||
    data.kind === 'send_sms' ||
    data.kind === 'send_whatsapp' ||
    data.kind === 'send_postal'
  ) {
    const output = data.params.output as OutputConfig
    if (output.mode === 'simple') {
      return (
        <>
          <Handle
            id="success"
            type="source"
            position={Position.Right}
            className={readOnlyHandleClass}
            style={{ borderColor: 'var(--success)', top: '35%' }}
          />
          <Handle
            id="failure"
            type="source"
            position={Position.Right}
            className={readOnlyHandleClass}
            style={{ borderColor: 'var(--danger)', top: '70%' }}
          />
        </>
      )
    }
    const n = output.outputs.length
    return (
      <>
        {output.outputs.map((o, i) => (
          <Handle
            key={o.id}
            id={o.id}
            type="source"
            position={Position.Right}
            className={readOnlyHandleClass}
            style={{ borderColor: 'var(--fg-muted)', top: `${((i + 1) / (n + 1)) * 100}%` }}
          />
        ))}
      </>
    )
  }
  return <Handle type="source" position={Position.Right} className={readOnlyHandleClass} />
}

function ReachabilityBadge({ state, blockedReason }: { state: ReachabilityState; blockedReason?: string }) {
  if (state === 'visited') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-semibold text-success"
        aria-label="Étape terminée"
      >
        <Icon name="Check" size={16} />
        Terminé
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary"
        aria-current="step"
      >
        <Icon name="Play" size={16} />
        En cours
      </span>
    )
  }
  if (state === 'reachable') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-fg-muted">
        À venir
      </span>
    )
  }
  if (state === 'blocked') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-semibold text-danger"
        data-rp-tooltip={blockedReason}
      >
        <Icon name="CircleAlert" size={16} />
        Bloqué
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-fg-subtle">
      Inatteignable
    </span>
  )
}
