import { useState, useEffect } from 'react'
import { FolderOpen, Download, Info } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

function SettingsSection({ title, icon: Icon, children }: {
  title: string
  icon: React.FC<{ size?: number; className?: string }>
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-md border border-warm-200 shadow-card">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-warm-100">
        <Icon size={14} className="text-warm-500" />
        <h3 className="text-xs font-medium text-warm-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </section>
  )
}

export default function Settings() {
  const [downloadDir, setDownloadDir] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getSettings().then((s) => {
      setDownloadDir(s.downloadDir)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateSettings(downloadDir)
      toast.success('设置已保存')
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-medium text-warm-800 mb-6">设置</h2>

      <div className="space-y-4">
        {/* Download settings */}
        <SettingsSection title="下载" icon={Download}>
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">
              下载目录
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={downloadDir}
                onChange={(e) => setDownloadDir(e.target.value)}
                placeholder="~/Downloads/SakuraDown"
                className="flex-1 h-10 px-3 bg-white border border-warm-300 rounded-md text-sm
                           placeholder:text-warm-400
                           focus:outline-none focus:border-caramel-400 focus:ring-1 focus:ring-caramel-400/20
                           transition-colors"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-10 px-4 rounded-md bg-caramel-400 hover:bg-caramel-500 text-white
                           text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
            <p className="text-xs text-warm-400 mt-1.5">
              下载的视频文件将保存到此目录
            </p>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-warm-700 mb-1.5">
              最大并行下载
            </label>
            <p className="text-sm text-warm-500">
              2 <span className="text-xs text-warm-400">个任务（服务器配置）</span>
            </p>
          </div>
        </SettingsSection>

        {/* About */}
        <SettingsSection title="关于" icon={Info}>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-warm-500">版本</span>
              <span className="text-warm-700 font-mono text-xs">v0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">引擎</span>
              <span className="text-warm-700">yt-dlp</span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">技术栈</span>
              <span className="text-warm-700">React + Fastify + WebSocket</span>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}
