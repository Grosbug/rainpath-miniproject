import type { Graph } from '@rainpath/shared'

export type EmailParams = Extract<Graph['nodes'][number]['data'], { kind: 'send_email' }>['params']
export type SmsParams = Extract<Graph['nodes'][number]['data'], { kind: 'send_sms' }>['params']
export type WhatsAppParams = Extract<Graph['nodes'][number]['data'], { kind: 'send_whatsapp' }>['params']
export type PostalParams = Extract<Graph['nodes'][number]['data'], { kind: 'send_postal' }>['params']
export type ConditionParams = Extract<Graph['nodes'][number]['data'], { kind: 'condition' }>['params']

export type AnyParams = EmailParams | SmsParams | WhatsAppParams | PostalParams | ConditionParams
