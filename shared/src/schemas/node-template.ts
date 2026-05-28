import { z } from 'zod'
import { EmailParams, SmsParams, WhatsAppParams, PostalParams, ConditionParams } from './node-data'

export const NodeTemplateKind = z.enum(['send_email', 'send_sms', 'send_whatsapp', 'send_postal', 'condition'])
export type NodeTemplateKind = z.infer<typeof NodeTemplateKind>

export const NodeTemplateBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('send_email'),    params: EmailParams }),
  z.object({ kind: z.literal('send_sms'),      params: SmsParams }),
  z.object({ kind: z.literal('send_whatsapp'), params: WhatsAppParams }),
  z.object({ kind: z.literal('send_postal'),   params: PostalParams }),
  z.object({ kind: z.literal('condition'),     params: ConditionParams })
])
export type NodeTemplateBody = z.infer<typeof NodeTemplateBody>

export const NodeTemplate = NodeTemplateBody.and(z.object({
  id:          z.string(),
  name:        z.string().min(1),
  description: z.string().optional(),
  createdAt:   z.string(),
  updatedAt:   z.string()
}))
export type NodeTemplate = z.infer<typeof NodeTemplate>
