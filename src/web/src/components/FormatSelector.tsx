import type { FormatOption } from '@sakuradown/shared'
import { cn } from '@/lib/utils'
import { Film, Music, Video } from 'lucide-react'

interface Props {
  formats: FormatOption[]
  selected: string | null
  onSelect: (id: string) => void
}

const iconForType = (type: FormatOption['type']) => {
  switch (type) {
    case 'audio-only': return Music
    case 'video-only': return Video
    default: return Film
  }
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '? MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb.toFixed(0)} MB`
}

export function FormatSelector({ formats, selected, onSelect }: Props) {
  // Group formats: common resolutions first, then audio-only
  const videoFormats = formats.filter(f => f.type !== 'audio-only')
  const audioFormats = formats.filter(f => f.type === 'audio-only')

  // Deduplicate by height, keep first (best quality)
  const seen = new Set<number>()
  const deduped = videoFormats.filter(f => {
    if (f.height === 0) return true
    if (seen.has(f.height)) return false
    seen.add(f.height)
    return true
  }).sort((a, b) => b.height - a.height)

  return (
    <div className="space-y-1.5">
      {deduped.map((f) => {
        const Icon = iconForType(f.type)
        const isSelected = selected === f.id
        return (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left',
              isSelected
                ? 'bg-sakura-500/10 border border-sakura-500/30 text-sakura-300'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700'
            )}
          >
            <Icon size={16} className="shrink-0 opacity-60" />
            <span className="flex-1">{f.note || `${f.height}p`}</span>
            <span className="text-xs text-neutral-500">{f.ext}</span>
            {f.filesize > 0 && (
              <span className="text-xs text-neutral-600">{formatSize(f.filesize)}</span>
            )}
          </button>
        )
      })}

      {/* Audio-only section */}
      {audioFormats.length > 0 && (
        <>
          <div className="pt-1">
            <p className="text-xs text-neutral-600 px-3 py-1">仅音频</p>
          </div>
          {audioFormats.slice(0, 3).map((f) => {
            const Icon = Music
            const isSelected = selected === f.id
            return (
              <button
                key={f.id}
                onClick={() => onSelect(f.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left',
                  isSelected
                    ? 'bg-sakura-500/10 border border-sakura-500/30 text-sakura-300'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700'
                )}
              >
                <Icon size={16} className="shrink-0 opacity-60" />
                <span className="flex-1">{f.note || `${f.ext} 音频`}</span>
                <span className="text-xs text-neutral-500">{f.ext}</span>
                {f.filesize > 0 && (
                  <span className="text-xs text-neutral-600">{formatSize(f.filesize)}</span>
                )}
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}
