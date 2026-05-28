import type { WhatsAppParams } from './form-types'

interface Props { value: WhatsAppParams; onChange: (v: WhatsAppParams) => void }

export function WhatsAppParamsForm(_: Props) {
  return <p className='text-sm text-fg-muted'>Formulaire WhatsApp — Task 11</p>
}
