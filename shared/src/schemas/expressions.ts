export const DataAvailableExpressions = [
  'patient.email',
  'patient.phone',
  'patient.whatsapp',
  'patient.address'
] as const

export type DataAvailableExpression = (typeof DataAvailableExpressions)[number]
