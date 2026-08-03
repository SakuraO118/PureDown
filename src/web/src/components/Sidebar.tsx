import { NavLink } from 'react-router-dom'
import { Home, Download, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/downloads', icon: Download, label: '下载' },
  { to: '/settings', icon: Settings, label: '设置' },
]

export function Sidebar() {
  return (
    <aside className="w-16 lg:w-56 border-r border-neutral-800 flex flex-col shrink-0">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-neutral-800">
        <span className="text-xl">🌸</span>
        <span className="hidden lg:inline font-semibold text-sakura-400">SakuraDown</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-sakura-500/10 text-sakura-400'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              )
            }
          >
            <Icon size={18} />
            <span className="hidden lg:inline">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
