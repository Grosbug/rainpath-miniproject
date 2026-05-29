import { CHANNEL_FORMAT_RULES } from '@rainpath/shared'
import { CharCounter } from './CharCounter'
import { DisplayNameField } from './DisplayNameField'
import { OutputConfigField } from './OutputConfigField'
import type { SmsParams } from './form-types'

interface Props {
  value: SmsParams
  onChange: (v: SmsParams) => void
}

const SMS = CHANNEL_FORMAT_RULES.sms.body

export function SmsParamsForm({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <DisplayNameField value={value.displayName} onChange={n => onChange({ ...value, displayName: n })} />
      <div>
        <label htmlFor="sms-body" className="mb-1 block text-sm font-medium text-fg">
          Message
        </label>
        <textarea
          id="sms-body"
          value={value.body}
          onChange={e => onChange({ ...value, body: e.target.value })}
          rows={4}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <CharCounter
          value={value.body.length}
          recommended={SMS.recommendedMax}
          max={SMS.maxLength}
          unicodeThreshold={SMS.unicodeThreshold}
        />
      </div>
      <OutputConfigField kind="send_sms" value={value.output} onChange={o => onChange({ ...value, output: o })} />
    </div>
  )
}
