import { icons, type LucideProps } from 'lucide-react'

export type IconName = keyof typeof icons
type Size = 16 | 20 | 24

interface IconProps extends Omit<LucideProps, 'size'> {
  name: IconName
  size?: Size
}

/**
 * Icon wrapper enforcing the DS §6 size scale (16 / 20 / 24 only)
 * and the single-source-of-icons policy (Lucide).
 */
export function Icon({ name, size = 16, ...rest }: IconProps) {
  const Component = icons[name]
  if (!Component) {
    if (import.meta.env.DEV) console.warn(`<Icon name="${name}"> not found in lucide-react`)
    return null
  }
  return <Component size={size} strokeWidth={1.5} aria-hidden="true" {...rest} />
}
