import { ReactNode } from 'react'
import { Icon, IconName } from '@/components/Icon'
import {
  DayBadge,
  FamilyHeader,
  FamilyStrip,
  NODE_CARD_BASE_CLASS,
  NodeTitle,
  dayBadgePadding,
  familyBgStyle,
  type NodeFamily
} from './node-chrome'

export type { NodeFamily }

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
 * Editor-side card. Shares the family-coloured chrome (strip, header, title,
 * J+N badge) with `<PatientNode>` via `./node-chrome`. The editor adds
 * selection ring + shadow, validation pips, and an actions slot.
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

  return (
    <div
      className={`group/nodecard ${NODE_CARD_BASE_CLASS} ${borderWidth} ${ring} ${dayBadgePadding(dayX)}`}
      style={{ ...familyBgStyle(family), WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      data-selected={selected ? 'true' : 'false'}
      tabIndex={0}
    >
      <FamilyStrip family={family} />

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

      {dayX !== undefined && <DayBadge family={family} dayX={dayX} />}

      <FamilyHeader icon={icon} label={familyLabel} />
      <NodeTitle title={title} />

      {details ? <div className="mt-2 space-y-1 text-xs text-fg-muted">{details}</div> : null}
      {handles}
      {actions}
    </div>
  )
}
