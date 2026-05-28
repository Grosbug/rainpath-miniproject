import type { ConditionParams } from './form-types'

interface Props { value: ConditionParams; onChange: (v: ConditionParams) => void }

export function ConditionParamsForm(_: Props) {
  return <p className='text-sm text-fg-muted'>Formulaire Condition — Task 13</p>
}
