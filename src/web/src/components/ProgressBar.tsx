import { cn } from '@/lib/utils'

interface Props {
  percent: number
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function ProgressBar({ percent, className, showLabel = true, size = 'sm' }: Props) {
  const clamped = Math.max(0, Math.min(100, percent))
  const height = size === 'sm' ? 'h-1' : 'h-1.5'

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('bg-white/40 backdrop-blur-sm rounded-full overflow-hidden', height)}>
        <div
          className={cn('bg-ocean-400 rounded-full transition-all duration-500 ease-out', height)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="block text-xs font-mono text-ink-500 mt-1 tabular-nums">
          {clamped.toFixed(1)}%
        </span>
      )}
    </div>
  )
}
