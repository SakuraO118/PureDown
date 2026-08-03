import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Clock, User, Download, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import type { VideoInfo as VideoInfoType } from '@sakuradown/shared'
import { FormatSelector } from '@/components/FormatSelector'
import { useDownload } from '@/hooks/useDownload'
import { toast } from 'sonner'

export default function VideoInfo() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { startDownload, trackProgress } = useDownload()
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  // Load video info from sessionStorage
  const raw = sessionStorage.getItem(`video-${id}`)
  if (!raw) {
    return (
      <div className="max-w-2xl mx-auto pt-32 px-4 text-center">
        <p className="text-neutral-500">视频信息已过期，请重新解析</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-sakura-400 hover:underline"
        >
          返回首页
        </button>
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
    setDownloading(selectedFormat)
    try {
      const taskId = await startDownload(video.webpageUrl, selectedFormat)
      trackProgress(taskId)
      toast.success('下载已开始')
    } catch (err) {
      toast.error((err as Error).message || '下载失败')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-neutral-500 hover:text-neutral-300 mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      <div className="flex gap-6">
        {/* Thumbnail */}
        {video.thumbnail && (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-72 rounded-xl object-cover shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold leading-tight mb-3">{video.title}</h1>
          <div className="flex items-center gap-4 text-sm text-neutral-400 mb-4">
            <span className="flex items-center gap-1">
              <User size={14} /> {video.uploader}
            </span>
            {video.duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={14} /> {formatDuration(video.duration)}
              </span>
            )}
          </div>

          {/* Playlist entries */}
          {video.isPlaylist && video.entries.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-neutral-500 mb-2">
                合集 · {video.entries.length} 个视频
                {video.playlistTitle && ` · ${video.playlistTitle}`}
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                {video.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 text-sm text-neutral-400 py-0.5"
                  >
                    <span className="text-neutral-600 w-6 text-right shrink-0">
                      {entry.index}.
                    </span>
                    <span className="truncate">{entry.title}</span>
                    <span className="text-neutral-600 shrink-0">
                      {formatDuration(entry.duration)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Format selector */}
          <div className="mb-4">
            <p className="text-sm text-neutral-500 mb-2">选择格式</p>
            <FormatSelector
              formats={video.formats}
              selected={selectedFormat}
              onSelect={setSelectedFormat}
            />
          </div>

          <button
            onClick={handleDownload}
            disabled={!selectedFormat || downloading !== null}
            className="w-full h-11 rounded-xl bg-sakura-500 hover:bg-sakura-600 text-white font-medium
                       flex items-center justify-center gap-2 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> 开始下载中...
              </>
            ) : (
              <>
                <Download size={18} /> 下载
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
