import type { SmsParams } from './form-types'

interface Props { value: SmsParams; onChange: (v: SmsParams) => void }

export function SmsParamsForm(_: Props) {
  return <p className='text-sm text-fg-muted'>Formulaire SMS — Task 11</p>
}
