import { useState, useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export default function Settings() {
  const [downloadDir, setDownloadDir] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSettings().then((s) => {
      setDownloadDir(s.downloadDir)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    try {
      await api.updateSettings(downloadDir)
      toast.success('保存成功')
    } catch (err) {
      toast.error('保存失败')
    }
  }

  if (loading) return null

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-semibold mb-6">设置</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-neutral-400 mb-1.5">下载目录</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={downloadDir}
              onChange={(e) => setDownloadDir(e.target.value)}
              className="flex-1 h-10 px-3 bg-neutral-900 border border-neutral-700 rounded-lg text-sm
                         focus:outline-none focus:border-sakura-500/50 transition-colors"
            />
            <button
              onClick={handleSave}
              className="h-10 px-4 rounded-lg bg-sakura-500 hover:bg-sakura-600 text-white text-sm
                         font-medium transition-colors"
            >
              保存
            </button>
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            下载的视频将保存到此目录
          </p>
        </div>
      </div>
    </div>
  )
}
