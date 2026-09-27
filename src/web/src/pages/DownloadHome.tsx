import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardPaste, Loader2 } from 'lucide-react'
import { useParseUrl } from '@/hooks/useParseUrl'

export default function DownloadHome() {
  const [url, setUrl] = useState('')
  const navigate = useNavigate()
  const parse = useParseUrl()
  const handleParse = async () => {
    if (!url.trim()) return
    try {
      const result = await parse.mutateAsync(url.trim())
      sessionStorage.setItem(`video-${result.video.id}`, JSON.stringify(result.video))
      navigate(`/video/${result.video.id}`)
    } catch { /* error rendered below */ }
  }
  const handlePaste = useCallback(async () => {
    try { setUrl(await navigator.clipboard.readText()) } catch { /* unavailable */ }
  }, [])
  return (
    <div className="max-w-xl mx-auto pt-24 pb-16 px-4">
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl font-light text-ink-900 mb-3">视频下载</h1>
        <p className="text-ink-500 text-sm">粘贴链接，选择格式，保存视频</p>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input value={url} onChange={event => setUrl(event.target.value)} onKeyDown={event => event.key === 'Enter' && handleParse()} placeholder="粘贴视频链接…" className="w-full h-12 px-4 pr-10 bg-white/75 backdrop-blur-md border border-white/30 rounded-xl text-sm focus:outline-none focus:border-ocean-400 focus:ring-2 focus:ring-ocean-400/20" />
          <button onClick={handlePaste} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400"><ClipboardPaste size={18} /></button>
        </div>
        <button onClick={handleParse} disabled={parse.isPending || !url.trim()} className="h-12 px-6 rounded-xl bg-ocean-400 hover:bg-ocean-500 text-white text-sm flex items-center gap-2 disabled:opacity-50">
          {parse.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}{parse.isPending ? '解析中' : '解析'}
        </button>
      </div>
      {parse.isError && <p className="text-sm text-red-500 mt-3">{(parse.error as Error).message}</p>}
      <p className="text-xs text-ink-400 text-center mt-6">支持 Bilibili · YouTube · 以及 yt-dlp 兼容站点</p>
    </div>
  )
}
