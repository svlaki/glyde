import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b border-border pb-6 pt-2 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <span className="inline-block size-2 rounded-full bg-primary" aria-hidden />
          <span>Productivity HQ</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 sm:pb-1">{actions}</div>}
    </div>
  )
}
