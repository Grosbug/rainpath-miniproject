import { Outlet, Link } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className='flex min-h-dvh flex-col bg-bg'>
      <header className='sticky top-0 z-20 flex h-12 items-center border-b border-border bg-surface px-6'>
        <Link to='/workflows' className='text-sm font-semibold tracking-tight text-fg'>
          RainPath
        </Link>
      </header>
      <main className='flex-1'>
        <Outlet />
      </main>
    </div>
  )
}
