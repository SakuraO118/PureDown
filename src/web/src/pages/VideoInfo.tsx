import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Clock, User, Download, Loader2, ArrowLeft, Check } from 'lucide-react'
import type { VideoInfo as VideoInfoType } from '@puredown/shared'
import { FormatSelector } from '@/components/FormatSelector'
import { EmptyState } from '@/components/EmptyState'
import { useDownload } from '@/hooks/useDownload'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export default function VideoInfo() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { startDownload } = useDownload()
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [done, setDone] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Load video info from sessionStorage
  const raw = sessionStorage.getItem(`video-${id}`)
  if (!raw) {
    return (
      <div className="max-w-5xl mx-auto p-6">
      <div className="max-w-5xl mx-auto p-6">
        <EmptyState
          icon={ArrowLeft}
          title="视频信息已过期"
          description="请返回首页重新解析视频链接"
          action={
            <button
              onClick={() => navigate('/')}
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

  const handleDownload = async () => {
    if (!selectedFormat) return
    setDownloading(true)
    try {
      const format = video.formats.find(f => f.id === selectedFormat)
      const downloadFormatId = format?.type === 'video-only'
        ? `${selectedFormat}+bestaudio[ext=m4a]/bestaudio`
        : selectedFormat

      // Server-side download: yt-dlp saves to server temp dir, progress shown on /downloads
      await startDownload(video.webpageUrl, downloadFormatId)

      setDone(true)
      toast.success('下载已开始，可前往下载管理查看进度')
    } catch (err) {
      toast.error((err as Error).message || '下载失败')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700 transition-colors mb-6"
      >
        <ArrowLeft size={14} /> 返回
      </button>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Thumbnail */}
        {video.thumbnail && !imgError ? (
          <img
            src={api.proxyImage(video.thumbnail)}
            alt={video.title}
            onError={() => setImgError(true)}
            className="w-full sm:w-96 rounded-2xl shadow-card object-contain shrink-0 sm:self-start bg-white/20"
          />
        ) : (
          <div className="w-full sm:w-80 h-48 rounded-2xl bg-white/30 flex items-center justify-center shrink-0">
          <div className="w-full sm:w-96 h-56 rounded-2xl bg-white/30 flex items-center justify-center shrink-0 sm:self-start">
            <span className="text-ink-400 text-sm">{video.thumbnail ? '封面加载失败' : '无封面'}</span>
          </div>
        )}

        <div className="flex-1 min-w-0 max-w-lg">
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
            disabled={!selectedFormat || downloading}
            className="w-full h-11 rounded-xl bg-ocean-400 hover:bg-ocean-500 text-white
                       font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-ocean-400/20"
          >
            {downloading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                开始下载中…
              </>
            ) : done ? (
              <>
                <Check size={16} />
                已添加到下载列表
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
