import { Icon } from '@/components/Icon'

const RUNS_PILL =
  'inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums'

type Props = {
  count?: number
  onClick?: () => void
  'aria-label'?: string
  'data-rp-tooltip'?: string
}

/** Badge « parcours » (icône Play dans une pilule primary-soft), avec compteur optionnel. */
export function PatientRunsBadge({ count, onClick, ...rest }: Props) {
  if (count !== undefined && count === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-fg-subtle">
        <Icon name="Minus" size={16} />
        Aucun
      </span>
    )
  }

  const content = (
    <>
      <Icon name="Play" size={16} />
      {count !== undefined && count > 0 ? count : null}
    </>
  )

  const className =
    RUNS_PILL +
    (onClick
      ? ' cursor-pointer transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      : '')

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} {...rest}>
        {content}
      </button>
    )
  }

  return (
    <span className={className} {...rest}>
      {content}
    </span>
  )
}
