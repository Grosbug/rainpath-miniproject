import type { Graph } from '@rainpath/shared'
import { CHANNEL_FAILURE_STATUSES } from '@rainpath/shared'
import { Icon, IconName } from '@/components/Icon'
import { relativeFromNow } from '@/lib/format-date'
import { frStatus } from '@/pages/WorkflowEditor/modal/status-labels'
import { useSidebarCollapsed } from './use-sidebar-collapsed'

type HistoryEntry = { nodeId: string; enteredAt: string; outcome?: string }

interface Props {
  graph: Graph
  history: HistoryEntry[]
  /** Run start date (J+0). Used to derive each entry's scheduled calendar date from
   *  the visited node's cumulative day offset in the graph. */
  startDate: string
}

/**
 * Project the run's start date forward by `days` (clamped ≥ 0) and format it in fr-FR.
 * Uses millisecond arithmetic on the parsed start date — robust to DST since we only
 * care about the calendar day, not the wall-clock hour.
 */
function scheduledDate(startISO: string, days: number): string {
  const ms = new Date(startISO).getTime() + Math.max(0, days) * 86_400_000
  return new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function nodeLabel(graph: Graph, nodeId: string): string {
  const n = graph.nodes.find(x => x.id === nodeId)
  if (!n) return nodeId
  const d = n.data
  if (d.kind === 'start') return 'Départ'
  if (d.kind === 'end') return 'Fin'
  if (d.kind === 'send_email') return `Email — ${d.params.subject || '(sans sujet)'}`
  if (d.kind === 'send_sms') return `SMS — ${d.params.body.slice(0, 32) || '(vide)'}`
  if (d.kind === 'send_whatsapp') return `WhatsApp — ${d.params.body.slice(0, 32) || '(vide)'}`
  if (d.kind === 'send_postal') return `Courrier — ${d.params.body.slice(0, 32) || '(vide)'}`
  return nodeId
}

const FAILURE_OUTCOMES = new Set<string>([
  ...CHANNEL_FAILURE_STATUSES.email,
  ...CHANNEL_FAILURE_STATUSES.sms,
  ...CHANNEL_FAILURE_STATUSES.whatsapp,
  ...CHANNEL_FAILURE_STATUSES.postal_tracked,
  ...CHANNEL_FAILURE_STATUSES.postal_untracked,
  'unopened'
])

const SUCCESS_OUTCOMES = new Set<string>([
  'delivered', 'opened', 'clicked', 'read', 'sent'
])

type Tone = 'success' | 'failure' | 'neutral'

function classifyOutcome(outcome?: string): Tone {
  if (!outcome) return 'neutral'
  if (FAILURE_OUTCOMES.has(outcome)) return 'failure'
  if (SUCCESS_OUTCOMES.has(outcome)) return 'success'
  return 'neutral'
}

const TONE_STYLES: Record<Tone, { container: string; icon: IconName; iconClass: string }> = {
  success: {
    container: 'border-success bg-[#DCFCE7]/40',
    icon: 'Check',
    iconClass: 'text-success'
  },
  failure: {
    container: 'border-danger bg-[#FEF2F2]',
    icon: 'CircleAlert',
    iconClass: 'text-danger'
  },
  neutral: {
    container: 'border-border bg-surface',
    icon: 'Check',
    iconClass: 'text-fg-muted'
  }
}

export function PatientHistoryList({ graph, history, startDate }: Props) {
  const [collapsed, setCollapsed] = useSidebarCollapsed('history')
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Historique <span className="ml-1 normal-case text-fg-subtle">({history.length})</span>
        </h2>
        <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={16} className="text-fg-muted" />
      </button>
      {collapsed ? null : (
      <ol className="space-y-1">
        {history.map((entry, ix) => {
          const tone = classifyOutcome(entry.outcome)
          const style = TONE_STYLES[tone]
          // Action date = run start (J+0) + the visited node's cumulative day offset.
          // The graph stores X positions in day-units; clamp to ≥ 0 to ignore any
          // accidentally-negative orphan values that might slip through.
          const node = graph.nodes.find(n => n.id === entry.nodeId)
          const dayOffset = node ? Math.max(0, Math.round(node.position.x)) : 0
          const scheduled = scheduledDate(startDate, dayOffset)
          return (
            <li
              key={ix}
              className={`flex items-start gap-2 rounded-md border p-2 text-xs ${style.container}`}
            >
              <Icon name={style.icon} size={16} className={`mt-0.5 shrink-0 ${style.iconClass}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{nodeLabel(graph, entry.nodeId)}</p>
                <p className="text-fg-muted tabular-nums">
                  <span data-rp-tooltip={`J+${dayOffset} depuis le départ`}>{scheduled}</span>
                  <span className="text-fg-subtle"> · J+{dayOffset}</span>
                  {entry.outcome ? <> · <span className="font-medium" data-rp-tooltip={entry.outcome}>{frStatus(entry.outcome)}</span></> : null}
                </p>
                <p className="text-fg-subtle text-[10px]" data-rp-tooltip={new Date(entry.enteredAt).toLocaleString('fr-FR')}>
                  Entré {relativeFromNow(entry.enteredAt)}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      )}
    </div>
  )
}
