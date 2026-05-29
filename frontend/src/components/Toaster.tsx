import { Toaster as Sonner } from 'sonner'

/**
 * Global toast surface — `richColors` is deliberately off so we apply our own
 * design-system palette via `classNames` (left-stripe accent like ValidationBanner,
 * not the saturated Sonner backgrounds). Default duration is 6 s — comfortable for
 * reading an error — and the close button is forced to stay visible (Sonner hides
 * it behind hover by default, which made the toast feel non-dismissable).
 */
export function Toaster() {
  return (
    <Sonner
      position='bottom-right'
      closeButton
      visibleToasts={3}
      toastOptions={{
        duration: 6000,
        classNames: {
          toast:
            'group pointer-events-auto flex w-full items-start gap-3 ' +
            'rounded-md border border-border bg-surface px-4 py-3 pr-10 ' +
            'text-sm text-fg shadow-elev-2',
          title: 'font-medium leading-snug',
          description: 'text-fg-muted leading-snug',
          icon: 'mt-0.5 shrink-0',
          // Always-visible close button (Sonner default: opacity-0 until hover).
          closeButton:
            '!static !translate-x-0 !translate-y-0 ' +
            '!order-last !ml-auto !mr-0 !mt-0 !h-6 !w-6 !rounded-full ' +
            '!border-border !bg-surface !text-fg-muted !opacity-100 ' +
            'hover:!bg-surface-muted hover:!text-fg ' +
            'focus-visible:!ring-2 focus-visible:!ring-primary focus-visible:!ring-offset-2 focus-visible:!ring-offset-bg',
          // Variant tints — 4 px family stripe + matching icon color (DS §3.2).
          error: '!border-l-4 !border-l-danger',
          success: '!border-l-4 !border-l-success',
          warning: '!border-l-4 !border-l-warning',
          info: '!border-l-4 !border-l-info',
          loading: '!border-l-4 !border-l-border-strong'
        }
      }}
    />
  )
}
