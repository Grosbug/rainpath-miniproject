import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Icon } from '@/components/Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'default' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed',
  secondary:
    'bg-surface text-fg border border-border hover:bg-surface-muted disabled:opacity-60 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-fg hover:bg-surface-muted disabled:opacity-60 disabled:cursor-not-allowed',
  danger:
    'bg-transparent text-danger hover:bg-[#FEF2F2] disabled:opacity-60 disabled:cursor-not-allowed'
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  default: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-base gap-2'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'default', loading, disabled, className, children, ...rest },
  ref
) {
  const classes =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    `${VARIANT[variant]} ${SIZE[size]} ${className ?? ''}`
  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Icon name='LoaderCircle' size={16} className='animate-spin' /> : children}
    </button>
  )
})
