import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      position='bottom-right'
      richColors
      closeButton
      visibleToasts={3}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: 'rounded-md border border-border bg-surface shadow-elev-2 text-sm text-fg',
          description: 'text-fg-muted'
        }
      }}
    />
  )
}
