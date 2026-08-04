import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-20 px-4', className)}>
      {Icon && (
        <div className="mb-4 text-warm-300">
          <Icon size={56} strokeWidth={1} />
        </div>
      )}
      <p className="text-sm font-medium text-warm-600 mb-1">{title}</p>
      {description && (
        <p className="text-xs text-warm-400 mb-4 text-center max-w-xs">{description}</p>
      )}
      {action}
    </div>
  )
}
