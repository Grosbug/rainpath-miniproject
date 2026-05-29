import { CSSProperties, ReactNode } from 'react'
import { Icon, IconName } from '@/components/Icon'

export type NodeFamily =
  | 'start'
  | 'end'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'postal'

interface NodeCardProps {
  family: NodeFamily
  icon: IconName
  title: string
  /** Family label rendered above the title (DS §7.3). */
  familyLabel: string
  details?: ReactNode
  /** Right-side and left-side handle slots; the node component sets these via React Flow `<Handle />`. */
  handles?: ReactNode
  /** Whether this node is currently selected (drawn with primary ring + elev-2). */
  selected?: boolean
  /** Thicker outer border used by end node (DS §7.3 end variant). */
  thickBorder?: boolean
  /** Cumulative delay from start in days. When defined, a "J+N" badge appears top-right. */
  dayX?: number
  /** Number of blocking validation errors targeting this node — drawn as a small red
   *  alert pip top-left so the user can spot the culprit at a glance. */
  errorCount?: number
  /** Same idea for warnings (orange triangle). Errors take precedence over warnings
   *  when both are present — a single most-severe pip is rendered. */
  warningCount?: number
  /** Optional overlay (e.g. kebab actions) positioned absolutely by the slot itself.
   *  Rendered inside the card's relative box but the card has no overflow clipping, so
   *  half-outside elements work. */
  actions?: ReactNode
}

/**
 * Shared card chrome for every editor node. Tokens live in `frontend/src/styles/tokens.css`
 * under `--node-<family>-{bg,border,accent}` per DS §3.3.
 *
 * Inline styles are used for the dynamic family-based color values to bypass
 * Tailwind JIT's static-scan limitation (JIT cannot pick up runtime-interpolated
 * arbitrary class names like `bg-[var(--node-${family}-bg)]`).
 */
export function NodeCard({
  family, icon, title, familyLabel, details, handles, selected, thickBorder, dayX,
  errorCount = 0, warningCount = 0, actions
}: NodeCardProps) {
  const ring = selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg shadow-elev-2' : 'shadow-elev-1'
  const borderWidth = thickBorder ? 'border-2' : 'border'

  const cardStyle: CSSProperties = {
    backgroundColor: `var(--node-${family}-bg)`,
    borderColor: `var(--node-${family}-border)`
  }

  const accentStyle: CSSProperties = {
    background: `var(--node-${family}-accent)`
  }

  const badgeStyle: CSSProperties | undefined = dayX !== undefined
    ? { color: `var(--node-${family}-accent)`, borderColor: `var(--node-${family}-border)` }
    : undefined

  // Right padding bumps up when the badge is shown so the family label doesn't run under it.
  const paddingRight = dayX !== undefined ? 'pr-12' : 'pr-3'

  return (
    <div
      className={`group/nodecard relative w-[176px] ${borderWidth} ${ring} select-none rounded-md py-3 pl-[15px] ${paddingRight} transition-shadow`}
      style={{ ...cardStyle, WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      data-selected={selected ? 'true' : 'false'}
      tabIndex={0}
    >
      {/* 3-px family strip on the left */}
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-md"
        style={accentStyle}
        aria-hidden="true"
      />

      {/* Validation pip — top-left, most-severe-wins. Errors stack visually with the strip
          but stay on top thanks to z-index; pip size matches the J+N badge for symmetry. */}
      {errorCount > 0 ? (
        <span
          className="absolute -left-1.5 -top-1.5 z-10 inline-flex h-5 min-w-[1.25rem] items-center justify-center gap-0.5 rounded-full bg-danger px-1 text-[10px] font-semibold text-white shadow-elev-1 ring-2 ring-bg"
          data-rp-tooltip={`${errorCount} erreur${errorCount > 1 ? 's' : ''} sur ce nœud — cliquer sur le badge en haut pour le détail`}
          aria-label={`${errorCount} erreur${errorCount > 1 ? 's' : ''} de validation sur ce nœud`}
        >
          <Icon name="CircleAlert" size={16} />
          {errorCount > 1 ? <span className="tabular-nums">{errorCount}</span> : null}
        </span>
      ) : warningCount > 0 ? (
        <span
          className="absolute -left-1.5 -top-1.5 z-10 inline-flex h-5 min-w-[1.25rem] items-center justify-center gap-0.5 rounded-full bg-warning px-1 text-[10px] font-semibold text-white shadow-elev-1 ring-2 ring-bg"
          data-rp-tooltip={`${warningCount} avertissement${warningCount > 1 ? 's' : ''} sur ce nœud`}
          aria-label={`${warningCount} avertissement${warningCount > 1 ? 's' : ''} de validation sur ce nœud`}
        >
          <Icon name="TriangleAlert" size={16} />
          {warningCount > 1 ? <span className="tabular-nums">{warningCount}</span> : null}
        </span>
      ) : null}
      {dayX !== undefined && (
        <span
          className="absolute right-2 top-2 rounded-full border bg-surface px-2 py-0.5 text-[10px] font-semibold tabular-nums leading-none shadow-elev-1"
          style={badgeStyle}
          aria-label={`Délai cumulé depuis le départ : ${dayX} jour${dayX > 1 ? 's' : ''}`}
        >
          J+{dayX}
        </span>
      )}
      <div className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
        <Icon name={icon} size={16} className="shrink-0" />
        <span className="truncate">{familyLabel}</span>
      </div>
      <h3 className="mt-1 text-sm font-semibold text-fg">
        <span className="line-clamp-1">{title}</span>
      </h3>
      {details ? <div className="mt-2 space-y-1 text-xs text-fg-muted">{details}</div> : null}
      {handles}
      {actions}
    </div>
  )
}
