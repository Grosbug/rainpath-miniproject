import type { ReactNode } from 'react'

interface Props {
  title: ReactNode
  /** Actions à droite — placer le bouton primary en dernier. */
  actions?: ReactNode
}

/** En-tête de page : titre à gauche, actions alignées à droite. */
export function PageHeader({ title, actions }: Props) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="min-w-0">{title}</div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}
