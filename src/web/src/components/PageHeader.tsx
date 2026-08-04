import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  title?: string
  breadcrumb?: { label: string; href?: string; onClick?: () => void }
  action?: ReactNode
  className?: string
}

export function PageHeader({ title, breadcrumb, action, className }: Props) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumb && (
        <button
          onClick={breadcrumb.onClick}
          className="inline-flex items-center gap-1 text-sm text-warm-500 hover:text-warm-700 transition-colors mb-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {breadcrumb.label}
        </button>
      )}
      <div className="flex items-center justify-between">
        {title && (
          <h2 className="text-lg font-medium text-warm-800">{title}</h2>
        )}
        {action}
      </div>
    </div>
  )
}
