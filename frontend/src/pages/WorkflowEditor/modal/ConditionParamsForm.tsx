import { DataAvailableExpressions } from '@rainpath/shared'
import type { ConditionParams } from './form-types'

interface Props {
  value: ConditionParams
  onChange: (v: ConditionParams) => void
}

const EXPR_LABELS: Record<string, string> = {
  'patient.email': 'Email connu',
  'patient.phone': 'Téléphone connu',
  'patient.whatsapp': 'WhatsApp connu',
  'patient.address': 'Adresse connue'
}

export function ConditionParamsForm({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-fg">Type de condition</legend>
        <div className="flex gap-2">
          <label className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium ${
            value.conditionType === 'data_available'
              ? 'border-primary bg-primary-soft text-primary'
              : 'border-border bg-surface text-fg-muted'
          }`}>
            <input
              type="radio"
              className="sr-only"
              checked={value.conditionType === 'data_available'}
              onChange={() => onChange({ conditionType: 'data_available', expression: DataAvailableExpressions[0] })}
            />
            Donnée disponible
          </label>
          <label className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium ${
            value.conditionType === 'previous_result'
              ? 'border-primary bg-primary-soft text-primary'
              : 'border-border bg-surface text-fg-muted'
          }`}>
            <input
              type="radio"
              className="sr-only"
              checked={value.conditionType === 'previous_result'}
              onChange={() => onChange({ conditionType: 'previous_result', expression: '' })}
            />
            Résultat précédent
          </label>
        </div>
      </fieldset>

      {value.conditionType === 'data_available' ? (
        <div>
          <label htmlFor="cond-expr-select" className="mb-1 block text-sm font-medium text-fg">
            Champ patient
          </label>
          <select
            id="cond-expr-select"
            value={value.expression}
            onChange={e => onChange({ conditionType: 'data_available', expression: e.target.value })}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {DataAvailableExpressions.map(expr => (
              <option key={expr} value={expr}>{EXPR_LABELS[expr] ?? expr}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label htmlFor="cond-expr-input" className="mb-1 block text-sm font-medium text-fg">
            Expression
          </label>
          <input
            id="cond-expr-input"
            value={value.expression}
            onChange={e => onChange({ conditionType: 'previous_result', expression: e.target.value })}
            placeholder="ex. last.status == rejected"
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm font-mono focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}
    </div>
  )
}
