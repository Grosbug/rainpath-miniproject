import * as RadixDialog from '@radix-ui/react-dialog'
import { ReactNode } from 'react'
import { Icon } from '@/components/Icon'

type DialogSize = 'sm' | 'md' | 'lg'

const WIDTH: Record<DialogSize, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[480px]',
  lg: 'max-w-[640px]'
}

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  size?: DialogSize
}

export function Dialog({ open, onOpenChange, title, description, children, size = 'md' }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className='fixed inset-0 z-[100] bg-[var(--elev-scrim)] data-[state=open]:animate-in data-[state=open]:fade-in' />
        <RadixDialog.Content
          className={
            'fixed left-1/2 top-1/2 z-[100] flex w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] -translate-x-1/2 -translate-y-1/2 flex-col ' +
            'rounded-lg bg-surface shadow-elev-3 ' +
            'data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 ' +
            WIDTH[size]
          }
        >
          <div className='flex shrink-0 items-start justify-between gap-4 px-6 pt-6'>
            <div>
              <RadixDialog.Title className='text-lg font-semibold text-fg'>{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className='mt-1 text-sm text-fg-muted'>
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close
              className='rounded-md p-1 text-fg-muted hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              aria-label='Fermer'
            >
              <Icon name='X' size={16} />
            </RadixDialog.Close>
          </div>
          <div className='mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-6'>{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
