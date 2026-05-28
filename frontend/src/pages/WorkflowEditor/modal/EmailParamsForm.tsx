import { CHANNEL_FORMAT_RULES } from '@rainpath/shared'
import { CharCounter } from './CharCounter'
import { OutputConfigField } from './OutputConfigField'
import type { EmailParams } from './form-types'

interface Props {
  value: EmailParams
  onChange: (v: EmailParams) => void
}

const SUB = CHANNEL_FORMAT_RULES.email.subject
const BODY = CHANNEL_FORMAT_RULES.email.body

export function EmailParamsForm({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="email-subject" className="mb-1 block text-sm font-medium text-fg">
          Sujet
        </label>
        <input
          id="email-subject"
          value={value.subject}
          onChange={e => onChange({ ...value, subject: e.target.value })}
          maxLength={SUB.maxLength + 1}
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <CharCounter value={value.subject.length} recommended={SUB.recommendedMax} max={SUB.maxLength} />
      </div>
      <div>
        <label htmlFor="email-body" className="mb-1 block text-sm font-medium text-fg">
          Corps
        </label>
        <textarea
          id="email-body"
          value={value.body}
          onChange={e => onChange({ ...value, body: e.target.value })}
          rows={6}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <CharCounter value={value.body.length} recommended={5000} max={BODY.maxLength} />
      </div>
      <OutputConfigField kind="send_email" value={value.output} onChange={o => onChange({ ...value, output: o })} />
    </div>
  )
}
