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
    <aside className="w-16 lg:w-56 border-r border-warm-300 bg-warm-100 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-warm-200">
        <span className="text-lg leading-none shrink-0">🌸</span>
        <span className="hidden lg:inline text-base font-display font-medium text-warm-800 tracking-wide">
          SakuraDown
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-caramel-100 text-caramel-500 border-l-[3px] border-l-caramel-400 pl-[9px]'
                  : 'text-warm-500 hover:bg-warm-200 hover:text-warm-700 border-l-[3px] border-l-transparent pl-[9px]'
              )
            }
          >
            <Icon size={18} strokeWidth={1.75} />
            <span className="hidden lg:inline">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Version */}
      <div className="px-4 py-3 border-t border-warm-200">
        <p className="hidden lg:block text-[11px] text-warm-400 select-none">
          v0.1.0
        </p>
      </div>
    </aside>
  )
}
