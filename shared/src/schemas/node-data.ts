import { z } from 'zod'
import { CHANNEL_FORMAT_RULES } from './format'
import { OutputConfig } from './output-config'

/**
 * Optional "display label" carried by every send_* node — typically the name of the
 * template it was instantiated from ("Première relance", "Rappel courtois"…). Used
 * by every renderer (editor cards, simulator cards, history list, validation toasts)
 * as the node's headline; the underlying subject/body still drives the actual message.
 * Optional so legacy nodes created before this field existed continue to read back.
 */
const DisplayName = z.string().max(80).optional()

export const EmailParams = z.object({
  displayName: DisplayName,
  subject: z.string().max(CHANNEL_FORMAT_RULES.email.subject.maxLength).default(''),
  body:    z.string().max(CHANNEL_FORMAT_RULES.email.body.maxLength).default(''),
  output:  OutputConfig
})
export type EmailParams = z.infer<typeof EmailParams>

export const SmsParams = z.object({
  displayName: DisplayName,
  body:   z.string().max(CHANNEL_FORMAT_RULES.sms.body.maxLength).default(''),
  output: OutputConfig
})
export type SmsParams = z.infer<typeof SmsParams>

export const WhatsAppParams = z.object({
  displayName: DisplayName,
  body:   z.string().max(CHANNEL_FORMAT_RULES.whatsapp.body.maxLength).default(''),
  output: OutputConfig
})
export type WhatsAppParams = z.infer<typeof WhatsAppParams>

export const PostalParams = z.object({
  displayName: DisplayName,
  body:    z.string().max(CHANNEL_FORMAT_RULES.postal.body.maxLength).default(''),
  tracked: z.boolean().default(false),
  output:  OutputConfig
})
export type PostalParams = z.infer<typeof PostalParams>

export const NodeData = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('start') }),
  z.object({ kind: z.literal('end') }),
  z.object({ kind: z.literal('send_email'),    params: EmailParams }),
  z.object({ kind: z.literal('send_sms'),      params: SmsParams }),
  z.object({ kind: z.literal('send_whatsapp'), params: WhatsAppParams }),
  z.object({ kind: z.literal('send_postal'),   params: PostalParams })
])
export type NodeData = z.infer<typeof NodeData>
export type NodeKind = NodeData['kind']
