import { CHANNEL_FORMAT_RULES } from '@rainpath/shared'
import { CharCounter } from './CharCounter'
import { DisplayNameField } from './DisplayNameField'
import { OutputConfigField } from './OutputConfigField'
import type { WhatsAppParams } from './form-types'

interface Props {
  value: WhatsAppParams
  onChange: (v: WhatsAppParams) => void
}

const WA = CHANNEL_FORMAT_RULES.whatsapp.body

export function WhatsAppParamsForm({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <DisplayNameField value={value.displayName} onChange={n => onChange({ ...value, displayName: n })} />
      <div>
        <label htmlFor="wa-body" className="mb-1 block text-sm font-medium text-fg">
          Message
        </label>
        <textarea
          id="wa-body"
          value={value.body}
          onChange={e => onChange({ ...value, body: e.target.value })}
          rows={4}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <CharCounter value={value.body.length} recommended={1000} max={WA.maxLength} />
        <p className="mt-1 text-xs text-fg-muted">
          Mise en forme WhatsApp : <code className="font-mono">*gras*</code>, <code className="font-mono">_italique_</code>, <code className="font-mono">~barré~</code>, <code className="font-mono">```mono```</code>.
        </p>
      </div>
      <OutputConfigField kind="send_whatsapp" value={value.output} onChange={o => onChange({ ...value, output: o })} />
    </div>
  )
}
