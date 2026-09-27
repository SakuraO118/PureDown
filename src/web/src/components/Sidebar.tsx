import { useState, useEffect, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Download, Settings, LogIn, Sparkles, History } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { BilibiliLogin } from './BilibiliLogin'

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/download', icon: Download, label: '视频下载' },
  { to: '/summarize', icon: Sparkles, label: '视频总结' },
  { to: '/analyses', icon: History, label: '分析历史' },
  { to: '/downloads', icon: Download, label: '下载记录' },
  { to: '/settings', icon: Settings, label: '设置' },
]

export function Sidebar() {
  const [showLogin, setShowLogin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      const status = await api.getBilibiliStatus()
      setLoggedIn(status.loggedIn)
    } catch { /* 忽略状态查询失败 */ }
  }, [])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  const handleLoginClick = async () => {
    if (loggedIn) {
      try {
        await api.bilibiliLogout()
        setLoggedIn(false)
        toast.success('已退出 B 站登录')
      } catch {
        toast.error('退出登录失败')
      }
      return
    }
    setShowLogin(true)
  }

  return (
    <aside data-pd="sidebar" className="group w-16 hover:w-56 border-r border-white/5 bg-white/10 backdrop-blur-xl flex flex-col shrink-0 transition-all duration-300 ease-out">
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
          onClick={handleLoginClick}
          title={loggedIn ? '已登录 · 点击退出' : 'B 站登录'}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-ink-500 hover:bg-white/50 hover:text-ink-700
                     transition-all duration-200 whitespace-nowrap overflow-hidden"
        >
          <span className="relative shrink-0">
            <LogIn size={18} strokeWidth={1.75} />
            {loggedIn && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 ring-2 ring-white/70" />
            )}
          </span>
          <span className="hidden group-hover:inline">{loggedIn ? '已登录' : 'B站登录'}</span>
        </button>
      </div>

      <BilibiliLogin
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={refreshStatus}
      />
    </aside>
  )
}
