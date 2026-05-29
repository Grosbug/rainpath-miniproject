import type { CSSProperties } from 'react'
import type { NodeFamily } from './nodes/NodeCard'
import type { NodeKind } from './modal-state'

export type SendNodeKind = Extract<NodeKind, 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_postal'>

export const SEND_KIND_FAMILY: Record<SendNodeKind, NodeFamily> = {
  send_email: 'email',
  send_sms: 'sms',
  send_whatsapp: 'whatsapp',
  send_postal: 'postal'
}

/** DS §3.3 node family tokens — same chrome as canvas NodeCard. */
export function nodeFamilyChrome(family: NodeFamily): {
  card: CSSProperties
  accent: CSSProperties
} {
  return {
    card: {
      backgroundColor: `var(--node-${family}-bg)`,
      borderColor: `var(--node-${family}-border)`
    },
    accent: { background: `var(--node-${family}-accent)` }
  }
}

export function nodeFamilyAccentColor(family: NodeFamily): string {
  return `var(--node-${family}-accent)`
}
