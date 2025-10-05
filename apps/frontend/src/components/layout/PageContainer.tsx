import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: ReactNode
  className?: string
  fullWidth?: boolean
}

export function PageContainer({ children, className, fullWidth = false }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10',
        !fullWidth && 'max-w-6xl',
        className
      )}
    >
      {children}
    </div>
  )
}
