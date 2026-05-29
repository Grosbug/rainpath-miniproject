import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Icon, IconName } from '@/components/Icon'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  /** Required for screen-readers — describes the action this button performs. */
  'aria-label': string
  size?: 'sm' | 'default'
  variant?: 'ghost' | 'danger'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = 'default', variant = 'ghost', className, ...rest },
  ref
) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  const tone = variant === 'danger' ? 'text-danger hover:bg-[#FEF2F2]' : 'text-fg hover:bg-surface-muted'
  // disabled: visibly inert — no hover, no pointer, faded. Native `:disabled` already blocks
  // clicks but the default visual is too subtle, especially next to enabled siblings.
  const disabledTone = 'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <button
      ref={ref}
      className={
        `inline-flex items-center justify-center rounded-md transition-colors ` +
        `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ` +
        `${dim} ${tone} ${disabledTone} ${className ?? ''}`
      }
      {...rest}
    >
      <Icon name={icon} size={16} />
    </button>
  )
})
