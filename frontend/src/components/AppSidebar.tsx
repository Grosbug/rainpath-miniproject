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

/** Aligné sur les libellés nav : px-3 (nav) + px-3 (lien) + icône 16px + gap-2.5 */
const NAV_LABEL_LEFT = 'left-16' /* 64px */

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
        (collapsed ? 'w-14' : 'w-46')
      }
      aria-label="Navigation principale"
    >
      <div className="relative h-12 w-full shrink-0 border-b border-border">
        {!collapsed ? (
          <Link
            to="/workflows"
            className="absolute left-7 top-1/2 z-10 -translate-y-1/2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="RainPath"
          >
            {LOGO}
          </Link>
        ) : null}

        {!collapsed ? (
          <Link
            to="/workflows"
            className={
              `absolute ${NAV_LABEL_LEFT} top-1/2 right-10 -translate-y-1/2 truncate ` +
              'text-sm font-semibold tracking-tight text-fg hover:text-primary ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm'
            }
          >
            RainPath
          </Link>
        ) : null}

        <button
          type="button"
          onClick={toggle}
          className={
            'absolute top-1/2 z-10 inline-flex -translate-y-1/2 items-center justify-center rounded-md ' +
            'border border-border bg-surface-muted text-fg transition-colors hover:bg-surface ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
            (collapsed
              ? 'left-1/2 h-9 w-9 -translate-x-1/2'
              : 'right-2 h-8 w-8')
          }
          aria-label={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
          aria-expanded={!collapsed}
          data-rp-tooltip={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
        >
          <Icon name={collapsed ? 'ChevronsRight' : 'ChevronsLeft'} size={16} />
        </button>
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
