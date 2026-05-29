import type { GraphNode } from './snapshot'

/** Whether `handle` is a legal React Flow source handle for this node. */
export function isValidDiscreteSourceHandle(
  sourceNode: GraphNode,
  handle: string | null | undefined
): boolean {
  const k = sourceNode.data.kind
  if (k !== 'send_email' && k !== 'send_sms' && k !== 'send_whatsapp' && k !== 'send_postal') {
    return true
  }
  const h = handle ?? undefined
  if (!h) return false
  const out = sourceNode.data.params.output
  if (out.mode === 'simple') return h === 'success' || h === 'failure'
  return out.outputs.some((o: { id: string }) => o.id === h)
}
