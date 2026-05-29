import { useState } from 'react'
import { Handle, NodeProps, Position } from '@xyflow/react'
import * as Popover from '@radix-ui/react-popover'
import { CHANNEL_STATUSES } from '@rainpath/shared'
import type { Graph, OutputConfig } from '@rainpath/shared'
import { Icon, IconName } from '@/components/Icon'
import { frStatus } from '@/pages/WorkflowEditor/modal/status-labels'
import {
  hasChannelData, failureStatusesForNode, missingChannelLabel,
  type PatientContactData
} from './cumulative-days'

/** Read-only mirror of the editor's handle styling — smaller, no hover/interaction. */
const readOnlyHandleClass = '!h-2 !w-2 !border-2 !bg-surface pointer-events-none'

export type ReachabilityState = 'visited' | 'current' | 'reachable' | 'blocked' | 'unreachable'

type NodeData = Graph['nodes'][number]['data']
export type PatientNodeData = NodeData & {
  reachability: ReachabilityState
  blockedReason?: string
  /** Cumulative delay from start in days (J+N badge top-right). */
  _dayX?: number
  /** Patient contact data — used by the inline status picker to filter the channel statuses. */
  _profile?: PatientContactData
  /** Currently staged observed status for this node (undefined = nothing picked yet). */
  _pendingStatus?: string
  /** Setter wired by PatientCanvas; absent on non-current nodes. */
  _onPickStatus?: (status: string | undefined) => void
}

type SendNodeData = Extract<NodeData, { kind: 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_postal' }>

/**
 * Statuses the simulator can actually route from this node — mirrors the editor
 * coverage rules so the inline picker doesn't offer a status that would crash
 * with `unhandled_outcome` on the backend. Patients missing the channel's
 * contact data only see the failure subset (a "delivered" status with no email
 * makes no sense).
 */
function routableStatusesFor(data: SendNodeData, profile: PatientContactData | undefined): string[] {
  const channel: readonly string[] =
    data.kind === 'send_email'    ? CHANNEL_STATUSES.email :
    data.kind === 'send_sms'      ? CHANNEL_STATUSES.sms :
    data.kind === 'send_whatsapp' ? CHANNEL_STATUSES.whatsapp :
    data.params.tracked ? CHANNEL_STATUSES.postal_tracked : CHANNEL_STATUSES.postal_untracked
  let candidates: string[] = [...channel]
  const out = data.params.output
  if (out.mode === 'multi') {
    const routed = new Set(out.outputs.flatMap(o => o.condition.statuses))
    candidates = candidates.filter(s => routed.has(s))
  }
  if (profile && !hasChannelData(data, profile)) {
    const failures = new Set<string>(failureStatusesForNode(data))
    candidates = candidates.filter(s => failures.has(s))
  }
  return candidates
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
 *
 * Note: `current` deliberately has no animation. `animate-pulse` (opacity
 * keyframes) creates a stacking context + compositing layer that interferes
 * with hit-testing of the inline status picker dropdown trigger inside the
 * card. The "en cours" emphasis is already carried by the primary border,
 * 2-px ring, elev-2 shadow, and the "En cours" badge — no need to pulse on
 * top of that.
 */
const REACH_OUTER: Record<ReachabilityState, string> = {
  visited:     '',
  current:     '',
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

        {d.reachability === 'current' && d._onPickStatus && isSendData(d) ? (
          <InlineStatusPicker
            data={d}
            profile={d._profile}
            value={d._pendingStatus}
            onChange={d._onPickStatus}
          />
        ) : null}

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

function isSendData(data: PatientNodeData): data is PatientNodeData & SendNodeData {
  return data.kind === 'send_email' || data.kind === 'send_sms'
      || data.kind === 'send_whatsapp' || data.kind === 'send_postal'
}

/**
 * Inline status picker rendered on the `current` send_* card. The dropdown
 * stages the user's choice in the simulator's pendingByNode map — the actual
 * mutation fires from the top-bar "Prochain" button, not from this select.
 *
 * The options list is rendered through a Radix Popover Portal so it escapes
 * React Flow's viewport stacking context entirely. Without the portal, the
 * absolute-positioned dropdown stayed nested inside `.react-flow__node` and
 * any sibling node card painted over it, making the options uncliquable.
 *
 * Filters statuses through `routableStatusesFor` so we never offer a status
 * that would crash the backend with `unhandled_outcome`. When the patient
 * lacks the channel's contact data, only failure statuses are offered (with
 * a small warning line above the select).
 */
function InlineStatusPicker({
  data, profile, value, onChange
}: {
  data: SendNodeData
  profile: PatientContactData | undefined
  value: string | undefined
  onChange: (status: string | undefined) => void
}) {
  const statuses = routableStatusesFor(data, profile)
  const lacksData = profile ? !hasChannelData(data, profile) : false
  const missingLabel = lacksData ? missingChannelLabel(data) : null
  const [open, setOpen] = useState(false)

  return (
    <div className="nodrag nowheel nopan mt-2 space-y-1">
      {lacksData && missingLabel ? (
        <p className="rounded border border-warning/60 bg-[#FFFBEB] px-1.5 py-1 text-[10px] leading-tight text-warning">
          <Icon name="TriangleAlert" size={16} className="-mt-0.5 mr-0.5 inline" />
          Pas de {missingLabel} — statuts d'échec seulement.
        </p>
      ) : null}
      {statuses.length === 0 ? (
        <p className="rounded border border-warning/60 bg-[#FFFBEB] px-1.5 py-1 text-[10px] leading-tight text-warning">
          Aucun statut routable depuis ce nœud.
        </p>
      ) : (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
            Statut observé
          </p>
          <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="flex h-7 w-full items-center justify-between gap-1 rounded border border-border bg-surface px-1.5 text-[11px] hover:bg-surface-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Choisir le statut observé"
              >
                <span className={value ? 'text-fg' : 'text-fg-muted'}>
                  {value ? frStatus(value) : 'Choisir…'}
                </span>
                <Icon name="ChevronDown" size={16} className="shrink-0 text-fg-muted" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                sideOffset={4}
                // Match the trigger width so the options column stays visually anchored.
                style={{ width: 'var(--radix-popover-trigger-width)' }}
                className="z-[1000] max-h-48 overflow-auto rounded-md border border-border bg-surface py-1 shadow-elev-2"
              >
                <ul role="listbox">
                  {statuses.map(s => (
                    <li
                      key={s}
                      role="option"
                      aria-selected={value === s}
                      onClick={() => { onChange(s); setOpen(false) }}
                      className={`flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-[11px] hover:bg-surface-muted ${
                        value === s ? 'font-medium text-primary' : 'text-fg'
                      }`}
                    >
                      {value === s ? <Icon name="Check" size={16} /> : <span className="w-4" />}
                      {frStatus(s)}
                    </li>
                  ))}
                </ul>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      )}
    </div>
  )
}
