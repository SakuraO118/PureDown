import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ClipboardPaste, Loader2 } from 'lucide-react'
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
      // Store result in sessionStorage so VideoInfo can access it
      sessionStorage.setItem(`video-${result.video.id}`, JSON.stringify(result.video))
      navigate(`/video/${result.video.id}`)
    } catch { /* error shown via toast from mutation state */ }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text)
    } catch { /* clipboard not available */ }
  }

  return (
    <div className="max-w-2xl mx-auto pt-32 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="text-sakura-400">Sakura</span>Down
        </h1>
        <p className="text-neutral-500">粘贴 Bilibili / YouTube 视频链接，开始下载</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleParse()}
            placeholder="https://www.bilibili.com/video/... 或 https://www.youtube.com/watch?..."
            className="w-full h-12 px-4 pr-10 bg-neutral-900 border border-neutral-700 rounded-xl text-sm
                       placeholder:text-neutral-600 focus:outline-none focus:border-sakura-500/50 transition-colors"
          />
          <button
            onClick={handlePaste}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500
                       hover:text-neutral-300 transition-colors"
            title="粘贴剪贴板"
          >
            <ClipboardPaste size={18} />
          </button>
        </div>
        <button
          onClick={handleParse}
          disabled={parse.isPending || !url.trim()}
          className={cn(
            'h-12 px-6 rounded-xl font-medium flex items-center gap-2 transition-all',
            'bg-sakura-500 hover:bg-sakura-600 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {parse.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Search size={18} />
          )}
          解析
        </button>
      </div>

      {parse.isError && (
        <p className="mt-3 text-red-400 text-sm">
          {(parse.error as Error)?.message || '解析失败，请检查链接是否正确'}
        </p>
      )}
    </div>
  )
}
