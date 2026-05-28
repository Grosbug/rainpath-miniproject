import { CSSProperties, ReactNode } from 'react'
import { Icon, IconName } from '@/components/Icon'

export type NodeFamily =
  | 'start'
  | 'end'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'postal'
  | 'cond-data'
  | 'cond-result'

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
  /** Compact width override (used by start/end at 180 px). */
  width?: 180 | 260
  /** Thicker outer border used by end node (DS §7.3 end variant). */
  thickBorder?: boolean
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
  family, icon, title, familyLabel, details, handles, selected, width = 260, thickBorder
}: NodeCardProps) {
  const ring = selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg shadow-elev-2' : 'shadow-elev-1'
  const widthCls = width === 180 ? 'w-[180px]' : 'w-[260px]'
  const borderWidth = thickBorder ? 'border-2' : 'border'

  const cardStyle: CSSProperties = {
    backgroundColor: `var(--node-${family}-bg)`,
    borderColor: `var(--node-${family}-border)`
  }

  const accentStyle: CSSProperties = {
    background: `var(--node-${family}-accent)`
  }

  return (
    <div
      className={`relative ${widthCls} ${borderWidth} ${ring} rounded-md p-3 transition-shadow`}
      style={cardStyle}
      tabIndex={0}
    >
      {/* 3-px family strip on the left */}
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-md"
        style={accentStyle}
        aria-hidden="true"
      />
      <div className="ml-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
        <Icon name={icon} size={16} />
        <span>{familyLabel}</span>
      </div>
      <h3 className="mt-1 ml-1 text-sm font-semibold text-fg" title={title}>
        <span className="line-clamp-1">{title}</span>
      </h3>
      {details ? <div className="mt-2 ml-1 space-y-1 text-xs text-fg-muted">{details}</div> : null}
      {handles}
    </div>
  )
}
