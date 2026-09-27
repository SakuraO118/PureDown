import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Clock, User, Download, ArrowLeft, Check } from 'lucide-react'
import type { VideoInfo as VideoInfoType } from '@puredown/shared'
import { FormatSelector } from '@/components/FormatSelector'
import { EmptyState } from '@/components/EmptyState'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export default function VideoInfo() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Load video info from sessionStorage
  const raw = sessionStorage.getItem(`video-${id}`)
  if (!raw) {
    return (
      <div className="p-6">
        <EmptyState
          icon={ArrowLeft}
          title="视频信息已过期"
          description="请返回首页重新解析视频链接"
          action={
            <button
              onClick={() => navigate('/download')}
              className="px-4 py-2 text-sm rounded-xl bg-ocean-400 hover:bg-ocean-500 text-white transition-colors shadow-md shadow-ocean-400/20"
            >
              返回首页
            </button>
          }
        />
      </div>
    )
  }

  const video: VideoInfoType = JSON.parse(raw)

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const handleDownload = () => {
    if (!selectedFormat) return
    const format = video.formats.find(f => f.id === selectedFormat)
    const downloadFormatId = format?.type === 'video-only'
      ? `${selectedFormat}+bestaudio[ext=m4a]/bestaudio`
      : selectedFormat

    // Direct streaming: yt-dlp stdout 直接流到浏览器，服务器只做中转不落盘
    const a = document.createElement('a')
    a.href = api.getStreamUrl(video.webpageUrl, downloadFormatId)
    a.download = ''
    document.body.appendChild(a)
    a.click()
    a.remove()

    setDone(true)
    toast.success('已开始下载，文件将保存到浏览器下载目录')
  }

  const handleDownloadImage = async () => {
    if (!video.thumbnail) return
    try {
      const res = await fetch(api.proxyImage(video.thumbnail))
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const extMatch = video.thumbnail.match(/\.(jpe?g|png|gif|webp)(\?|$)/i)
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg'
      const safeTitle = video.title.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 60)
      a.download = `${safeTitle}_封面.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('封面图已开始下载')
    } catch {
      toast.error('封面图下载失败')
    }
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/download')}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700 transition-colors mb-6"
      >
        <ArrowLeft size={14} /> 返回
      </button>

      <div className="flex flex-col sm:flex-row justify-center gap-6">
        {/* Thumbnail */}
        {video.thumbnail && !imgError ? (
          <div className="relative w-full sm:w-[1000px] shrink-0 sm:self-start">
            <img
              src={api.proxyImage(video.thumbnail)}
              alt={video.title}
              onError={() => setImgError(true)}
              className="w-full sm:h-[561px] rounded-2xl shadow-card object-contain bg-white/20"
            />
            <button
              onClick={handleDownloadImage}
              title="下载封面图"
              className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                         bg-white/75 backdrop-blur-md border border-white/40 text-ink-600
                         hover:bg-white/95 hover:text-ink-800 text-xs font-medium shadow-card transition-all"
            >
              <Download size={14} />
              下载封面
            </button>
          </div>
        ) : (
          <div className="w-full sm:w-96 h-56 rounded-2xl bg-white/30 flex items-center justify-center shrink-0 sm:self-start">
            <span className="text-ink-400 text-sm">{video.thumbnail ? '封面加载失败' : '无封面'}</span>
          </div>
        )}

        <div className="flex-none w-[512px]">
          {/* Title */}
          <h1 className="font-display text-xl font-medium text-ink-800 leading-snug mb-3">
            {video.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-ink-500 mb-5">
            <span className="flex items-center gap-1.5">
              <User size={14} strokeWidth={1.5} />
              {video.uploader || '未知 UP 主'}
            </span>
            {video.duration > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock size={14} strokeWidth={1.5} />
                {formatDuration(video.duration)}
              </span>
            )}
          </div>

          {/* Playlist summary */}
          {video.isPlaylist && video.entries.length > 0 && (
            <details className="mb-5">
              <summary className="text-sm text-ink-500 cursor-pointer hover:text-ink-600 transition-colors select-none">
                合集 · {video.entries.length} 个视频
                {video.playlistTitle && ` — ${video.playlistTitle}`}
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5 pl-1 border-l-2 border-white/25">
                {video.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 text-sm text-ink-500 py-0.5 pl-2"
                  >
                    <span className="text-ink-400 w-6 text-right shrink-0 text-xs font-mono">
                      {entry.index}.
                    </span>
                    <span className="truncate flex-1">{entry.title}</span>
                    <span className="text-ink-400 shrink-0 text-xs font-mono">
                      {formatDuration(entry.duration)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Format selector */}
          <div className="mb-5">
            <p className="text-xs font-medium text-ink-500 mb-2 uppercase tracking-wide">选择格式</p>
            <FormatSelector
              formats={video.formats}
              selected={selectedFormat}
              onSelect={setSelectedFormat}
            />
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={!selectedFormat}
            className="w-full h-11 rounded-xl bg-ocean-400 hover:bg-ocean-500 text-white
                       font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-ocean-400/20"
          >
            {done ? (
              <>
                <Check size={16} />
                已开始下载
              </>
            ) : (
              <>
                <Download size={16} />
                下载
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
