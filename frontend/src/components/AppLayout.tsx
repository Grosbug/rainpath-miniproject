import { Outlet } from 'react-router-dom'
import { Tooltip } from '@/components/Tooltip'
import { AnchoredToasts } from '@/components/AnchoredToasts'
import { AppSidebar } from '@/components/AppSidebar'

export function AppLayout() {
  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <Tooltip />
      <AnchoredToasts />
    </div>
  )
}
