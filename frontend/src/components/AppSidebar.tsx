import { Link, NavLink } from 'react-router-dom'
import { Icon, type IconName } from '@/components/Icon'
import { useAppNavCollapsed } from './use-app-nav-collapsed'

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/workflows', label: 'Workflows', icon: 'Network' },
  { to: '/patient-profiles', label: 'Patients', icon: 'Users' },
  { to: '/docs', label: 'Documentation', icon: 'BookOpen' }
]

function navClass({ isActive }: { isActive: boolean }, collapsed: boolean): string {
  const base =
    'flex items-center rounded-md text-sm font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  const layout = collapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
  const tone = isActive
    ? 'bg-primary-soft text-primary'
    : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
  return `${base} ${layout} ${tone}`
}

const LOGO = (
  <img
    src="/favicon.svg"
    alt=""
    width={24}
    height={24}
    className="h-6 w-6 shrink-0 rounded-[5px]"
  />
)

export function AppSidebar() {
  const [collapsed, setCollapsed] = useAppNavCollapsed()
  const toggle = () => setCollapsed(c => !c)

  return (
    <aside
      className={
        'flex h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ' +
        (collapsed ? 'w-14' : 'w-52')
      }
      aria-label="Navigation principale"
    >
      <div
        className={
          'flex shrink-0 border-b border-border ' +
          (collapsed
            ? 'flex-col items-center justify-center gap-2 px-1.5 py-2'
            : 'relative h-12 w-full flex-row items-center gap-2 px-3')
        }
      >
        <button
          type="button"
          onClick={toggle}
          className={
            'relative z-10 inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted ' +
            'text-fg transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 ' +
            'focus-visible:ring-ring focus-visible:ring-offset-2 ' +
            (collapsed ? 'h-9 w-9' : 'h-8 w-8')
          }
          aria-label={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
          aria-expanded={!collapsed}
          data-rp-tooltip={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
        >
          <Icon name={collapsed ? 'ChevronsRight' : 'ChevronsLeft'} size={16} />
        </button>

        {collapsed ? (
          <Link
            to="/workflows"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="RainPath"
            data-rp-tooltip="RainPath"
          >
            {LOGO}
          </Link>
        ) : (
          <>
            <Link
              to="/workflows"
              className={
                'absolute left-1/2 max-w-[calc(100%-5.5rem)] -translate-x-1/2 truncate ' +
                'text-sm font-semibold tracking-tight text-fg hover:text-primary ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1'
              }
            >
              RainPath
            </Link>
            <Link
              to="/workflows"
              className="relative z-10 ml-auto shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="RainPath"
            >
              {LOGO}
            </Link>
          </>
        )}
      </div>

      <nav className={`flex flex-1 flex-col gap-1 py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={state => navClass(state, collapsed)}
            data-rp-tooltip={collapsed ? item.label : undefined}
          >
            <Icon name={item.icon} size={16} className="shrink-0" />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="truncate">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
