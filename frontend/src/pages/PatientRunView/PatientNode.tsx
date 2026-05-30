import { useState } from 'react'
import { Handle, NodeProps, Position } from '@xyflow/react'
import * as Popover from '@radix-ui/react-popover'
import {
  hasContactForSendNode,
  isChannelFailureStatus
} from './outcome-routing'
import type { Graph, GraphNode, OutputConfig } from '@rainpath/shared'
import { nodeDisplayTitle } from '@rainpath/shared'
import { Icon, IconName } from '@/components/Icon'
import { frStatus } from '@/pages/WorkflowEditor/modal/status-labels'
import type { PatientContactData } from './cumulative-days'

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
  /** Switch focus to this branch (parallel lanes) — click the card. */
  _onFocus?: () => void
  /** Statuses with a routable edge for this node (send_* only). */
  _observableStatuses?: readonly string[]
  _graphNode?: GraphNode
  _graph?: Graph
  _nodeId?: string
}

type SendNodeData = Extract<NodeData, { kind: 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_postal' }>

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

// Delegated to the shared `nodeDisplayTitle` (imported below) so the editor card and
// the simulator card stay in lockstep — both prefer `params.displayName` (template
// identity) and fall back to subject/body otherwise.

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
  const title = nodeDisplayTitle(d)

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

  const focusable = !!d._onFocus

  return (
    <div className={REACH_OUTER[d.reachability]}>
      <div
        role={focusable ? 'button' : undefined}
        tabIndex={focusable ? 0 : undefined}
        onClick={focusable ? d._onFocus : undefined}
        onKeyDown={focusable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            d._onFocus?.()
          }
        } : undefined}
        className={`relative w-[176px] ${ring} rounded-md py-3 pl-[15px] ${paddingRight} ${
          focusable ? 'cursor-pointer hover:shadow-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' : ''
        }`}
        style={cardStyle}
        data-rp-tooltip={focusable ? 'Cliquer pour traiter cette branche' : undefined}
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

        {d._onPickStatus && isSendData(d) ? (
          <InlineStatusPicker
            data={d}
            graphNode={d._graphNode}
            profile={d._profile}
            statuses={d._observableStatuses ?? []}
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
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
        À traiter
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
 * lacks the channel's contact data, only failure statuses are offered (a
 * warning icon next to the picker label explains why on hover).
 */
function InlineStatusPicker({
  data, graphNode, profile, statuses, value, onChange
}: {
  data: SendNodeData
  graphNode?: GraphNode
  profile?: PatientContactData
  statuses: readonly string[]
  value: string | undefined
  onChange: (status: string | undefined) => void
}) {
  const optionStatuses = (() => {
    if (!value || statuses.includes(value)) return statuses
    return [...statuses, value]
  })()
  const successStatuses = graphNode
    ? optionStatuses.filter(s => !isChannelFailureStatus(graphNode, s))
    : optionStatuses
  const failureStatuses = graphNode
    ? optionStatuses.filter(s => isChannelFailureStatus(graphNode, s))
    : []
  const [open, setOpen] = useState(false)

  const lacksContact = graphNode && profile ? !hasContactForSendNode(graphNode, profile) : false
  const pickedFailureWhileContactOk =
    graphNode &&
    profile &&
    hasContactForSendNode(graphNode, profile) &&
    value !== undefined &&
    isChannelFailureStatus(graphNode, value)

  const channelLabel =
    data.kind === 'send_email' ? 'email' :
    data.kind === 'send_sms' ? 'SMS' :
    data.kind === 'send_whatsapp' ? 'WhatsApp' :
    'postales'

  const noticeIcon = (() => {
    // `lacksContact` is checked first: when contact is missing, success statuses
    // are filtered out upstream, so an empty `statuses` here is almost always
    // caused by missing contact + no routed failure edge — not by a missing edge
    // alone. Showing the "no routable status" message in that case would hide
    // the real, actionable cause (fill in the profile).
    if (lacksContact) {
      const msg = statuses.length === 0
        ? `Coordonnées ${channelLabel} absentes du profil — la sortie succès est inaccessible et aucune sortie échec n'est reliée. Complétez le profil ou reliez une sortie échec dans l'éditeur.`
        : `Coordonnées ${channelLabel} absentes du profil — seule la sortie échec est possible. Complétez le profil pour emprunter la sortie succès.`
      return (
        <span
          data-rp-tooltip={msg}
          data-rp-tooltip-wrap="true"
          className="inline-flex text-warning"
        >
          <Icon name="TriangleAlert" size={16} />
        </span>
      )
    }
    if (statuses.length === 0) {
      return (
        <span
          data-rp-tooltip="Aucun statut routable — vérifiez dans l'éditeur que les sorties succès et/ou échec sont reliées."
          data-rp-tooltip-wrap="true"
          className="inline-flex text-warning"
        >
          <Icon name="TriangleAlert" size={16} />
        </span>
      )
    }
    if (pickedFailureWhileContactOk) {
      return (
        <span
          data-rp-tooltip="Le contact est renseigné : choisissez un statut sous « Sortie succès » pour suivre la branche succès (sinon vous restez sur la sortie échec)."
          data-rp-tooltip-wrap="true"
          className="inline-flex text-info"
        >
          <Icon name="Info" size={16} />
        </span>
      )
    }
    return null
  })()

  return (
    <div className="nodrag nowheel nopan mt-2 space-y-1">
      {/* z-index lifts the icon's hover surface above the React Flow pane overlay
          that otherwise swallows pointer events (same trick as the picker button). */}
      <div
        className="mb-1 flex items-center gap-1"
        style={{ pointerEvents: 'auto', position: 'relative', zIndex: 100 }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
          Statut observé
        </p>
        {noticeIcon}
      </div>
      {statuses.length > 0 ? (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                // `z-index: 100` + `position: relative` are LOAD-BEARING here.
                // Without them an invisible overlay from a sibling React Flow
                // layer (likely the .react-flow__nodes container's own pane
                // capture) sat on top of the trigger and swallowed every
                // click. Forcing the button into its own stacking context
                // above z-100 lifts it past anything RF renders within the
                // node tree. `pointer-events: auto` is belt-and-braces in
                // case a parent flips to `none` during a hover transition.
                style={{ pointerEvents: 'auto', zIndex: 100, position: 'relative' }}
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
                <ul role="listbox" className="space-y-1">
                  {successStatuses.length > 0 ? (
                    <li className="px-2 pt-1 text-[9px] font-semibold uppercase tracking-wide text-success">
                      Sortie succès
                    </li>
                  ) : null}
                  {successStatuses.map(s => (
                    <StatusOption key={s} status={s} selected={value === s} onPick={() => { onChange(s); setOpen(false) }} />
                  ))}
                  {failureStatuses.length > 0 ? (
                    <li className="px-2 pt-1 text-[9px] font-semibold uppercase tracking-wide text-danger">
                      Sortie échec
                    </li>
                  ) : null}
                  {failureStatuses.map(s => (
                    <StatusOption key={s} status={s} selected={value === s} onPick={() => { onChange(s); setOpen(false) }} />
                  ))}
                </ul>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
      ) : null}
    </div>
  )
}

function StatusOption({
  status, selected, onPick
}: { status: string; selected: boolean; onPick: () => void }) {
  return (
    <li
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={`flex cursor-pointer items-center justify-center gap-1.5 px-2 py-1.5 text-center text-[11px] hover:bg-surface-muted ${
        selected ? 'font-medium text-primary' : 'text-fg'
      }`}
    >
      {selected ? <Icon name="Check" size={16} /> : null}
      <span>{frStatus(status)}</span>
    </li>
  )
}
