import { ClipboardList } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface TaskEmptyStateProps {
  onCreate: () => void
}

export function TaskEmptyState({ onCreate }: TaskEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-6 py-16 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ClipboardList className="size-8" />
      </span>
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-foreground">No tasks yet</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Create your first task to start organizing priorities, setting focus time, and letting Glyde keep everything aligned.
        </p>
      </div>
      <Button onClick={onCreate} className="px-6">
        Create a task
      </Button>
    </div>
  )
}
