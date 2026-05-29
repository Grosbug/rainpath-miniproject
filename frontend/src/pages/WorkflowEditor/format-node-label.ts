import { nodeDisplayTitle } from '@rainpath/shared'
import type { GraphNode } from './snapshot'

/**
 * Compact, human-friendly identifier for a node used in validation messages and toasts.
 * Format: "<Kind> — <Title>" where Title is the shared `nodeDisplayTitle` (template
 * name when available, otherwise body excerpt). Trimmed to ~32 chars so messages don't
 * overflow the toast. Falls back to the raw id when the node can't be found in the
 * current snapshot (e.g. node deleted between the validation pass and the render).
 */
export function formatNodeLabel(nodeId: string | undefined, nodes: ReadonlyArray<GraphNode>): string | null {
  if (!nodeId) return null
  const n = nodes.find(x => x.id === nodeId)
  if (!n) return nodeId
  const d = n.data
  if (d.kind === 'start') return 'Départ'
  if (d.kind === 'end') return 'Fin'
  const ellipsize = (s: string) => (s.length > 32 ? s.slice(0, 31) + '…' : s)
  const title = ellipsize(nodeDisplayTitle(d))
  if (d.kind === 'send_email')    return `Email — ${title}`
  if (d.kind === 'send_sms')      return `SMS — ${title}`
  if (d.kind === 'send_whatsapp') return `WhatsApp — ${title}`
  if (d.kind === 'send_postal')   return `Courrier — ${title}`
  return nodeId
}
