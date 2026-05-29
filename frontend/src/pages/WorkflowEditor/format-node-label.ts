import type { GraphNode } from './snapshot'

/**
 * Compact, human-friendly identifier for a node used in validation messages and toasts.
 * Format: "<Kind> — <Title>" with the title trimmed to ~32 chars. Falls back to the raw
 * id when the node can't be found in the current snapshot (e.g. node deleted between the
 * validation pass and the render).
 */
export function formatNodeLabel(nodeId: string | undefined, nodes: ReadonlyArray<GraphNode>): string | null {
  if (!nodeId) return null
  const n = nodes.find(x => x.id === nodeId)
  if (!n) return nodeId
  const d = n.data
  if (d.kind === 'start') return 'Départ'
  if (d.kind === 'end') return 'Fin'
  const titleFor = (s: string) => (s.length > 32 ? s.slice(0, 31) + '…' : s) || '(vide)'
  if (d.kind === 'send_email')    return `Email — ${titleFor(d.params.subject || '(sans sujet)')}`
  if (d.kind === 'send_sms')      return `SMS — ${titleFor(d.params.body)}`
  if (d.kind === 'send_whatsapp') return `WhatsApp — ${titleFor(d.params.body)}`
  if (d.kind === 'send_postal')   return `Courrier — ${titleFor(d.params.body)}`
  return nodeId
}
