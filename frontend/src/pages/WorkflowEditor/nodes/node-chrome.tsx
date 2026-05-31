import type { CSSProperties } from 'react'
import { Icon, type IconName } from '@/components/Icon'

export type NodeFamily =
  | 'start'
  | 'end'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'postal'

/**
 * Shared visual primitives between the editor `<NodeCard>` and the simulator
 * `<PatientNode>` — both render a 176-px-wide card with a family-coloured
 * left strip, an icon + family label header, a title, and an optional J+N
 * badge top-right. Before this module the two card components diverged on
 * spacing, badge styling and CSS-variable wiring; centralising the chrome
 * keeps them in lockstep.
 *
 * Each card composes the primitives with its own outer wrapper because the
 * surrounding chrome differs:
 *   - editor: ring/shadow for selection, optional validation pip + actions
 *   - patient: dynamic border colour for reachability, focusable wrapper
 */

export const NODE_CARD_BASE_CLASS =
  'relative w-[176px] select-none rounded-md py-3 pl-[15px] transition-shadow'

/** Right padding to keep the family label from running under the J+N badge. */
export function dayBadgePadding(dayX: number | undefined): string {
  return dayX !== undefined ? 'pr-12' : 'pr-3'
}

export function familyBgStyle(family: NodeFamily): CSSProperties {
  return {
    backgroundColor: `var(--node-${family}-bg)`,
    borderColor: `var(--node-${family}-border)`
  }
}

export function FamilyStrip({ family }: { family: NodeFamily }) {
  return (
    <div
      className="absolute left-0 top-0 h-full w-[3px] rounded-l-md"
      style={{ background: `var(--node-${family}-accent)` }}
      aria-hidden="true"
    />
  )
}

export function FamilyHeader({ icon, label }: { icon: IconName; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
      <Icon name={icon} size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  )
}

export function NodeTitle({ title }: { title: string }) {
  return (
    <h3 className="mt-1 text-sm font-semibold text-fg" data-rp-tooltip={title}>
      <span className="line-clamp-1">{title}</span>
    </h3>
  )
}

export function DayBadge({ family, dayX }: { family: NodeFamily; dayX: number }) {
  return (
    <span
      className="absolute right-2 top-2 rounded-full border bg-surface px-2 py-0.5 text-[10px] font-semibold tabular-nums leading-none shadow-elev-1"
      style={{
        color: `var(--node-${family}-accent)`,
        borderColor: `var(--node-${family}-border)`
      }}
      aria-label={`Délai cumulé depuis le départ : ${dayX} jour${dayX > 1 ? 's' : ''}`}
    >
      J+{dayX}
    </span>
  )
}
