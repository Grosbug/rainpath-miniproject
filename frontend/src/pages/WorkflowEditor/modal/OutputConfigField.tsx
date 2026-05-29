import { CHANNEL_STATUSES, CHANNEL_FAILURE_STATUSES } from '@rainpath/shared'
import { Icon } from '@/components/Icon'
import { frStatus } from './status-labels'
import type { Graph } from '@rainpath/shared'

type SendKind = 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_postal'
type OutputConfig = Extract<Graph['nodes'][number]['data'], { kind: 'send_email' }>['params']['output']
type MultiOutput = Extract<OutputConfig, { mode: 'multi' }>

interface Props {
  kind: SendKind
  tracked?: boolean
  value: OutputConfig
  onChange: (v: OutputConfig) => void
}

function channelKey(kind: SendKind, tracked?: boolean): keyof typeof CHANNEL_STATUSES {
  if (kind === 'send_email') return 'email'
  if (kind === 'send_sms') return 'sms'
  if (kind === 'send_whatsapp') return 'whatsapp'
  return tracked ? 'postal_tracked' : 'postal_untracked'
}

export function OutputConfigField({ kind, tracked, value, onChange }: Props) {
  const ck = channelKey(kind, tracked)
  const statuses = CHANNEL_STATUSES[ck]
  // Simple mode = success-only picker → hide statuses that can never be a success
  // (the implicit "failure" bucket catches them). Multi mode still lists every status
  // so a workflow can route a dedicated branch (e.g. on bounce).
  const failureStatuses = CHANNEL_FAILURE_STATUSES[ck] as readonly string[]
  const successCandidates: readonly string[] = (statuses as readonly string[]).filter(s => !failureStatuses.includes(s))

  const setMode = (mode: 'simple' | 'multi') => {
    if (mode === 'simple') return onChange({ mode: 'simple', successCondition: { statuses: [...successCandidates] } })
    return onChange({
      mode: 'multi',
      outputs: [{ id: 'out_1', label: 'Sortie 1', condition: { statuses: [...statuses] } }]
    })
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-muted p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Sortie</h4>
      <div className="flex gap-2">
        {(['simple', 'multi'] as const).map(m => (
          <label
            key={m}
            className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium ${
              value.mode === m ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-fg-muted'
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              checked={value.mode === m}
              onChange={() => setMode(m)}
            />
            {m === 'simple' ? 'Succès/Échec' : 'Multi'}
          </label>
        ))}
      </div>

      {value.mode === 'simple' && (
        <div>
          <p className="mb-1 text-xs font-medium text-fg-muted">Statuts considérés comme succès</p>
          <StatusChecklist
            available={successCandidates}
            selected={value.successCondition.statuses.filter(s => successCandidates.includes(s))}
            onChange={next => onChange({ mode: 'simple', successCondition: { statuses: next } })}
          />
        </div>
      )}

      {value.mode === 'multi' && (
        <div className="space-y-3">
          {value.outputs.map((out, ix) => (
            <div key={ix} className="rounded-md border border-border bg-surface p-2">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={out.label}
                  onChange={e => {
                    const next = [...value.outputs]
                    next[ix] = { ...out, label: e.target.value }
                    onChange({ mode: 'multi', outputs: next })
                  }}
                  className="h-7 flex-1 rounded border border-border bg-surface px-2 text-sm"
                />
                <input
                  value={out.id}
                  onChange={e => {
                    const next = [...value.outputs]
                    next[ix] = { ...out, id: e.target.value }
                    onChange({ mode: 'multi', outputs: next })
                  }}
                  className="h-7 w-24 rounded border border-border bg-surface px-2 text-xs font-mono text-fg-muted"
                  data-rp-tooltip="Identifiant du handle"
                />
                <button
                  type="button"
                  onClick={() => onChange({ mode: 'multi', outputs: value.outputs.filter((_, i) => i !== ix) })}
                  disabled={value.outputs.length <= 1}
                  className="rounded-md p-1 text-fg-muted hover:bg-surface-muted disabled:opacity-50"
                  aria-label="Supprimer cette sortie"
                >
                  ×
                </button>
              </div>
              <StatusChecklist
                available={statuses}
                selected={out.condition.statuses}
                onChange={next => {
                  const updated = [...value.outputs]
                  updated[ix] = { ...out, condition: { statuses: next } }
                  onChange({ mode: 'multi', outputs: updated })
                }}
              />
            </div>
          ))}
          <MissingStatusesAlert value={value} statuses={statuses} onChange={onChange} />
          <button
            type="button"
            onClick={() => {
              const existing = value.outputs
                .map(o => parseInt(o.id.replace(/^out_/, ''), 10))
                .filter(n => Number.isFinite(n))
              const nextIx = (existing.length > 0 ? Math.max(...existing) : 0) + 1
              onChange({
                mode: 'multi',
                outputs: [...value.outputs, {
                  id: `out_${nextIx}`,
                  label: `Sortie ${nextIx}`,
                  condition: { statuses: [] }
                }]
              })
            }}
            className="flex h-8 w-full items-center justify-center gap-1 rounded-md border border-dashed border-border bg-surface text-sm text-fg-muted hover:bg-surface-muted"
          >
            + Ajouter une sortie
          </button>
        </div>
      )}
    </div>
  )
}

function MissingStatusesAlert({
  value, statuses, onChange
}: {
  value: MultiOutput
  statuses: readonly string[]
  onChange: (v: OutputConfig) => void
}) {
  const covered = new Set(value.outputs.flatMap(o => o.condition.statuses))
  const missing = statuses.filter(s => !covered.has(s))
  if (missing.length === 0) return null

  const plural = missing.length > 1
  const addCatchAll = () => {
    const existing = value.outputs
      .map(o => parseInt(o.id.replace(/^out_/, ''), 10))
      .filter(n => Number.isFinite(n))
    const nextIx = (existing.length > 0 ? Math.max(...existing) : 0) + 1
    onChange({
      mode: 'multi',
      outputs: [...value.outputs, {
        id: `out_${nextIx}`,
        label: 'Autres',
        condition: { statuses: missing }
      }]
    })
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-2 rounded-md border border-warning bg-[#FFFBEB] p-3 text-xs"
    >
      <Icon name="TriangleAlert" size={16} className="mt-0.5 shrink-0 text-warning" />
      <div className="flex-1 space-y-2">
        <p className="font-medium text-fg">
          {missing.length} statut{plural ? 's' : ''} non routé{plural ? 's' : ''}
          {' — '}
          <span className="font-normal text-fg-muted">
            leur survenue ne déclenchera aucune sortie.
          </span>
        </p>
        <div className="flex flex-wrap gap-1">
          {missing.map(s => (
            <span
              key={s}
              className="rounded-full border border-warning bg-surface px-2 py-0.5 text-warning"
            >
              {frStatus(s)}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={addCatchAll}
          className="font-medium text-warning underline-offset-2 hover:underline"
        >
          Créer une sortie « Autres » regroupant ces statuts
        </button>
      </div>
    </div>
  )
}

function StatusChecklist({
  available, selected, onChange
}: { available: readonly string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {available.map(s => {
        const active = selected.includes(s)
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(active ? selected.filter(x => x !== s) : [...selected, s])}
            data-rp-tooltip={s}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              active
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border bg-surface text-fg-muted hover:bg-surface-muted'
            }`}
          >
            {frStatus(s)}
          </button>
        )
      })}
    </div>
  )
}
