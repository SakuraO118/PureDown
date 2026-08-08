import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Download, Settings, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BilibiliLogin } from './BilibiliLogin'

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/downloads', icon: Download, label: '下载' },
  { to: '/settings', icon: Settings, label: '设置' },
]

export function Sidebar() {
  const [showLogin, setShowLogin] = useState(false)

  return (
    <aside className="group w-16 hover:w-56 border-r border-white/5 bg-white/10 backdrop-blur-xl flex flex-col shrink-0 transition-all duration-300 ease-out">
      {/* Navigation */}
      <nav className="flex-1 p-2 pt-3 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden',
                isActive
                  ? 'bg-ocean-50/80 text-ocean-500'
                  : 'text-ink-500 hover:bg-white/50 hover:text-ink-700'
              )
            }
          >
            <Icon size={18} strokeWidth={1.75} className="shrink-0" />
            <span className="hidden group-hover:inline">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bilibili Login */}
      <div className="p-2 pb-3">
        <button
          onClick={() => setShowLogin(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-ink-500 hover:bg-white/50 hover:text-ink-700
                     transition-all duration-200 whitespace-nowrap overflow-hidden"
        >
          <LogIn size={18} strokeWidth={1.75} className="shrink-0" />
          <span className="hidden group-hover:inline">B站登录</span>
        </button>
      </div>

      <BilibiliLogin open={showLogin} onClose={() => setShowLogin(false)} />
    </aside>
  )
}
