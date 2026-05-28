import type { EmailParams } from './form-types'

interface Props { value: EmailParams; onChange: (v: EmailParams) => void }

export function EmailParamsForm(_: Props) {
  return <p className='text-sm text-fg-muted'>Formulaire Email — Task 10</p>
}
