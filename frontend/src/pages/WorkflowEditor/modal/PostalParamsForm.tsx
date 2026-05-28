import { CHANNEL_FORMAT_RULES } from '@rainpath/shared'
import { CharCounter } from './CharCounter'
import { OutputConfigField } from './OutputConfigField'
import type { PostalParams } from './form-types'

interface Props {
  value: PostalParams
  onChange: (v: PostalParams) => void
}

const POSTAL = CHANNEL_FORMAT_RULES.postal.body

export function PostalParamsForm({ value, onChange }: Props) {
  const setTracked = (tracked: boolean) => {
    if (!tracked && value.output.mode !== 'single') {
      onChange({ ...value, tracked, output: { mode: 'single' } })
    } else {
      onChange({ ...value, tracked })
    }
  }
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="postal-body" className="mb-1 block text-sm font-medium text-fg">
          Courrier
        </label>
        <textarea
          id="postal-body"
          value={value.body}
          onChange={e => onChange({ ...value, body: e.target.value })}
          rows={6}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <CharCounter value={value.body.length} recommended={5000} max={POSTAL.maxLength} />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.tracked}
          onChange={e => setTracked(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-fg">Envoi suivi (avec accusé de réception)</span>
      </label>
      <OutputConfigField
        kind="send_postal"
        tracked={value.tracked}
        value={value.output}
        onChange={o => onChange({ ...value, output: o })}
      />
    </div>
  )
}
