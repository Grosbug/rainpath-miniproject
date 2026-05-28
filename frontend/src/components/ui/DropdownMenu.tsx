import * as RDM from '@radix-ui/react-dropdown-menu'
import { ReactNode } from 'react'
import { Icon, IconName } from '@/components/Icon'

export const DropdownMenu = RDM.Root
export const DropdownTrigger = RDM.Trigger
export const DropdownPortal = RDM.Portal

export function DropdownContent({ children }: { children: ReactNode }) {
  return (
    <RDM.Portal>
      <RDM.Content
        align='end'
        sideOffset={4}
        className='z-50 min-w-[200px] rounded-md border border-border bg-surface p-1 shadow-elev-2'
      >
        {children}
      </RDM.Content>
    </RDM.Portal>
  )
}

export interface DropdownItemProps {
  icon?: IconName
  onSelect: () => void
  danger?: boolean
  children: ReactNode
}

export function DropdownItem({ icon, onSelect, danger, children }: DropdownItemProps) {
  return (
    <RDM.Item
      onSelect={onSelect}
      className={
        'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none ' +
        (danger ? 'text-danger hover:bg-[#FEF2F2]' : 'text-fg hover:bg-surface-muted')
      }
    >
      {icon ? <Icon name={icon} size={14 as any} /> : null}
      <span>{children}</span>
    </RDM.Item>
  )
}

export function DropdownSeparator() {
  return <RDM.Separator className='my-1 h-px bg-border' />
}
