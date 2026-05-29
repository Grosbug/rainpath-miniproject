interface Props {
  /** Current display name (typically pre-filled with the template name on drop). */
  value: string | undefined
  onChange: (next: string | undefined) => void
}

/**
 * "Nom affiché" input shared across every send_* params form. Sits at the top of each
 * form so the user can rename a node's headline without touching the subject / body.
 *
 * The field is OPTIONAL — leaving it empty falls back to the historical subject/body
 * excerpt via `nodeDisplayTitle()`. The setter emits `undefined` instead of "" when
 * the input is cleared so the underlying graph stays clean (omitted key vs explicit
 * empty string).
 */
export function DisplayNameField({ value, onChange }: Props) {
  return (
    <div>
      <label htmlFor="node-display-name" className="mb-1 block text-sm font-medium text-fg">
        Nom affiché
        <span className="ml-2 text-xs font-normal text-fg-muted">(facultatif)</span>
      </label>
      <input
        id="node-display-name"
        type="text"
        value={value ?? ''}
        onChange={e => {
          const next = e.target.value
          onChange(next.length === 0 ? undefined : next)
        }}
        maxLength={80}
        placeholder="ex. Première relance"
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="mt-1 text-[11px] text-fg-muted">
        Affiché comme titre sur la carte du nœud, dans l'historique et les listes.
        Si vide, c'est le sujet ou le début du message qui est utilisé.
      </p>
    </div>
  )
}
