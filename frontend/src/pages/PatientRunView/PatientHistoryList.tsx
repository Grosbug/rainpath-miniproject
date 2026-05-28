import type { Graph } from '@rainpath/shared'
import { Icon } from '@/components/Icon'
import { relativeFromNow } from '@/lib/format-date'

type HistoryEntry = { nodeId: string; enteredAt: string; outcome?: string }

interface Props {
  graph: Graph
  history: HistoryEntry[]
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
  if (d.kind === 'condition') return `Condition — ${d.params.expression}`
  return nodeId
}

export function PatientHistoryList({ graph, history }: Props) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Historique</h2>
      <ol className="space-y-1">
        {history.map((entry, ix) => (
          <li key={ix} className="flex items-start gap-2 rounded-md border border-border bg-surface p-2 text-xs">
            <Icon name="Check" size={16} className="mt-0.5 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fg">{nodeLabel(graph, entry.nodeId)}</p>
              <p className="text-fg-muted tabular-nums">
                {relativeFromNow(entry.enteredAt)}
                {entry.outcome ? <> · <span className="font-mono">{entry.outcome}</span></> : null}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
