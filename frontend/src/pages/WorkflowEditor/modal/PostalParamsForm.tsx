import type { PostalParams } from './form-types'

interface Props { value: PostalParams; onChange: (v: PostalParams) => void }

export function PostalParamsForm(_: Props) {
  return <p className='text-sm text-fg-muted'>Formulaire Postal — Task 12</p>
}
