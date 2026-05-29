import type { NodeData } from '../schemas/node-data'

/**
 * Canonical "what to show on a node card" string. Send_* nodes prefer their
 * `displayName` (typically the template they were dropped from) so the operator can
 * tell two emails with similar bodies apart at a glance. When `displayName` is empty
 * or absent — legacy nodes created before this field existed, or nodes created from
 * scratch — we fall back to a short excerpt of the subject / body, keeping the older
 * behaviour.
 *
 * Pure / synchronous so every renderer can share it without dragging React state.
 */
export function nodeDisplayTitle(data: NodeData): string {
  if (data.kind === 'start') return 'Examen effectué'
  if (data.kind === 'end') return 'Patient relancé'
  const display = data.params.displayName?.trim()
  if (display) return display
  if (data.kind === 'send_email') return data.params.subject || '(sans sujet)'
  if (data.kind === 'send_sms') return data.params.body.slice(0, 28) || '(SMS vide)'
  if (data.kind === 'send_whatsapp') return data.params.body.slice(0, 32) || '(message vide)'
  return data.params.body.slice(0, 32) || '(courrier vide)'
}
