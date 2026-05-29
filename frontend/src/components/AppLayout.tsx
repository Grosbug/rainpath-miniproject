import { Outlet, Link, useLocation } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Tooltip } from '@/components/Tooltip'
import { AnchoredToasts } from '@/components/AnchoredToasts'

export function AppLayout() {
  const location = useLocation()
  const isPatients = location.pathname.startsWith('/patient-profiles')
  const isDocs = location.pathname.startsWith('/docs')
  const isWorkflows = !isPatients && !isDocs && location.pathname.startsWith('/workflows')
  return (
    <div className='flex min-h-dvh flex-col bg-bg'>
      <header className='sticky top-0 z-20 flex h-12 items-center gap-6 border-b border-border bg-surface px-6'>
        <Link to='/workflows' className='text-sm font-semibold tracking-tight text-fg'>
          RainPath
        </Link>
        <nav className='flex items-center gap-1 text-sm'>
          <Link
            to='/workflows'
            className={`rounded-md px-2 py-1 ${isWorkflows ? 'bg-surface-muted text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            Workflows
          </Link>
          <Link
            to='/patient-profiles'
            className={`rounded-md px-2 py-1 ${isPatients ? 'bg-surface-muted text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            Patients
          </Link>
          <Link
            to='/docs'
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 ${isDocs ? 'bg-surface-muted text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            <Icon name='BookOpen' size={16} />
            Documentation
          </Link>
        </nav>
      </header>
      <main className='flex-1'>
        <Outlet />
      </main>
      <Tooltip />
      <AnchoredToasts />
    </div>
  )
}
