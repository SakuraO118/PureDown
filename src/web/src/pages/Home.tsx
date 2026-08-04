import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardPaste, Loader2, ArrowRight } from 'lucide-react'
import { useParseUrl } from '@/hooks/useParseUrl'
import { cn } from '@/lib/utils'

export default function Home() {
  const [url, setUrl] = useState('')
  const navigate = useNavigate()
  const parse = useParseUrl()

  const handleParse = async () => {
    if (!url.trim()) return
    try {
      const result = await parse.mutateAsync(url.trim())
      sessionStorage.setItem(`video-${result.video.id}`, JSON.stringify(result.video))
      navigate(`/video/${result.video.id}`)
    } catch { /* error shown via toast */ }
  }

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text)
    } catch { /* clipboard not available */ }
  }, [])

  // Global Ctrl+V paste listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        handlePaste()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlePaste])

  return (
    <div className="max-w-xl mx-auto pt-24 pb-16 px-4">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="font-display text-5xl font-light text-warm-800 tracking-wide mb-3">
          SakuraDown
        </h1>
        <p className="text-warm-500 text-sm">
          粘贴视频链接，选择格式，开始下载
        </p>
      </div>

      {/* URL Input */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleParse()}
            disabled={parse.isPending}
            placeholder="粘贴 Bilibili / YouTube 视频链接…"
            className={cn(
              'w-full h-12 px-4 pr-10 bg-white border rounded-md text-sm transition-colors',
              'placeholder:text-warm-400',
              'focus:outline-none focus:border-caramel-400 focus:ring-1 focus:ring-caramel-400/20',
              parse.isError
                ? 'border-red-300'
                : 'border-warm-300'
            )}
          />
          <button
            onClick={handlePaste}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-warm-400
                       hover:text-warm-600 transition-colors"
            title="粘贴 (Ctrl+V)"
          >
            <ClipboardPaste size={18} />
          </button>
        </div>
        <button
          onClick={handleParse}
          disabled={parse.isPending || !url.trim()}
          className={cn(
            'h-12 px-6 rounded-md font-medium text-sm flex items-center gap-2 transition-colors shrink-0',
            'bg-caramel-400 hover:bg-caramel-500 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {parse.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              解析中…
            </>
          ) : (
            <>
              解析
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {parse.isError && (
        <p className="text-sm text-red-500 mb-3">
          {(parse.error as Error)?.message || '解析失败，请检查链接是否正确'}
        </p>
      )}

      {/* Supported sites hint */}
      <p className="text-xs text-warm-400 text-center mt-6">
        支持 Bilibili · YouTube · 以及 yt-dlp 兼容的所有站点
      </p>
    </div>
  )
}
