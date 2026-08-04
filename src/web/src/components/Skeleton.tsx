import { cn } from '@/lib/utils'

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-warm-200 rounded-sm', className)} />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-md border border-warm-200 p-4 space-y-3">
      <SkeletonBlock className="h-4 w-3/4" />
      <SkeletonBlock className="h-3 w-1/2" />
      <SkeletonBlock className="h-2 w-full" />
    </div>
  )
}

export function SkeletonVideoInfo() {
  return (
    <div className="flex gap-6">
      <SkeletonBlock className="w-72 h-44 shrink-0 rounded-md" />
      <div className="flex-1 space-y-3">
        <SkeletonBlock className="h-6 w-3/4" />
        <div className="flex gap-4">
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-4 w-16" />
        </div>
        <div className="space-y-2 pt-2">
          <SkeletonBlock className="h-10 w-full rounded-md" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
        </div>
        <SkeletonBlock className="h-11 w-full rounded-md" />
      </div>
    </div>
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}
