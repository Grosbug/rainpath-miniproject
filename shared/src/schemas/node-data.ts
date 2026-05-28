import { z } from 'zod'
import { CHANNEL_FORMAT_RULES } from './format'
import { OutputConfig } from './output-config'

export const EmailParams = z.object({
  subject: z.string().max(CHANNEL_FORMAT_RULES.email.subject.maxLength).default(''),
  body:    z.string().max(CHANNEL_FORMAT_RULES.email.body.maxLength).default(''),
  output:  OutputConfig
})
export type EmailParams = z.infer<typeof EmailParams>

export const SmsParams = z.object({
  body:   z.string().max(CHANNEL_FORMAT_RULES.sms.body.maxLength).default(''),
  output: OutputConfig
})
export type SmsParams = z.infer<typeof SmsParams>

export const WhatsAppParams = z.object({
  body:   z.string().max(CHANNEL_FORMAT_RULES.whatsapp.body.maxLength).default(''),
  output: OutputConfig
})
export type WhatsAppParams = z.infer<typeof WhatsAppParams>

export const PostalParams = z.object({
  body:    z.string().max(CHANNEL_FORMAT_RULES.postal.body.maxLength).default(''),
  tracked: z.boolean().default(false),
  output:  OutputConfig
})
export type PostalParams = z.infer<typeof PostalParams>

export const ConditionParams = z.object({
  conditionType: z.enum(['data_available', 'previous_result']),
  expression: z.string()
})
export type ConditionParams = z.infer<typeof ConditionParams>

export const NodeData = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('start') }),
  z.object({ kind: z.literal('end') }),
  z.object({ kind: z.literal('send_email'),    params: EmailParams }),
  z.object({ kind: z.literal('send_sms'),      params: SmsParams }),
  z.object({ kind: z.literal('send_whatsapp'), params: WhatsAppParams }),
  z.object({ kind: z.literal('send_postal'),   params: PostalParams }),
  z.object({ kind: z.literal('condition'),     params: ConditionParams })
])
export type NodeData = z.infer<typeof NodeData>
export type NodeKind = NodeData['kind']
