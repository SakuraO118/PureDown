import type { FormatOption } from '@puredown/shared'
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

function formatSampleRate(asr: number): string {
  if (!asr || asr <= 0) return ''
  if (asr >= 1000) return `${(asr / 1000).toFixed(1)}kHz`
  return `${asr}Hz`
}

export function FormatSelector({ formats, selected, onSelect }: Props) {
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
    <div className="space-y-1">
      {deduped.map((f) => {
        const Icon = iconForType(f.type)
        const isSelected = selected === f.id
        return (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left',
              'border-l-[3px]',
              isSelected
                ? 'bg-ocean-50/80 border border-ocean-300 border-l-ocean-400 text-ink-700'
                : 'bg-white/60 backdrop-blur-sm border border-white/25 border-l-transparent text-ink-600 hover:border-white/40 hover:bg-white/80'
            )}
          >
            <Icon size={15} className={cn('shrink-0', isSelected ? 'text-ocean-500' : 'text-ink-400')} />
            <span className="flex-1 font-medium">{f.note || `${f.height}p`}</span>
            <span className="text-xs text-ink-400 font-mono">{f.ext}</span>
            {f.filesize > 0 && (
              <span className="text-xs text-ink-400">{formatSize(f.filesize)}</span>
            )}
          </button>
        )
      })}

      {/* Audio-only section */}
      {audioFormats.length > 0 && (
        <>
          <div className="pt-3 pb-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-white/30" />
              <span className="text-[11px] text-ink-400 uppercase tracking-wide font-medium">仅音频</span>
              <div className="flex-1 h-px bg-white/30" />
            </div>
          </div>
          {audioFormats.slice(0, 3).map((f) => {
            const isSelected = selected === f.id
            return (
              <button
                key={f.id}
                onClick={() => onSelect(f.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left',
                  'border-l-[3px]',
                  isSelected
                    ? 'bg-ocean-50/80 border border-ocean-300 border-l-ocean-400 text-ink-700'
                    : 'bg-white/60 backdrop-blur-sm border border-white/25 border-l-transparent text-ink-600 hover:border-white/40 hover:bg-white/80'
                )}
              >
                <Music size={15} className={cn('shrink-0', isSelected ? 'text-ocean-500' : 'text-ink-400')} />
                <span className="flex-1 font-medium">{f.note || `${f.ext} 音频`}</span>
                {f.asr > 0 && (
                  <span className="text-xs text-ink-500 font-mono">{formatSampleRate(f.asr)}</span>
                )}
                <span className="text-xs text-ink-400 font-mono">{f.ext}</span>
                {f.filesize > 0 && (
                  <span className="text-xs text-ink-400">{formatSize(f.filesize)}</span>
                )}
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}
