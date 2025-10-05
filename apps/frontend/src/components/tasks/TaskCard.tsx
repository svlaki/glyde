import { CheckCircle2, Clock3, PencilLine, Tag, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { Category } from '@/lib/categoryService'
import type { Task } from '@/lib/taskService'
import { cn } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  category?: Category
  onComplete: (taskId: string) => void
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})

const priorityMap: Record<NonNullable<Task['priority']>, { label: string; tone: string }> = {
  low: { label: 'Low', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  medium: { label: 'Medium', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
  high: { label: 'High', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  urgent: { label: 'Urgent', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' }
}

const energyMap: Record<NonNullable<Task['energy_required']>, string> = {
  low: 'Low energy',
  medium: 'Medium energy',
  high: 'High energy'
}

export function TaskCard({ task, category, onComplete, onEdit, onDelete }: TaskCardProps) {
  const dueDate = task.due_date ? dateFormatter.format(new Date(task.due_date)) : null
  const createdDate = task.created_at ? dateFormatter.format(new Date(task.created_at)) : null
  const priorityBadge = task.priority ? priorityMap[task.priority] : null

  return (
    <Card
      elevation="sm"
      className={cn(
        'border-border/70 transition-all duration-200',
        task.status === 'completed' && 'border-green-500/60 bg-green-500/5'
      )}
    >
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle className="text-xl font-semibold text-foreground">{task.title}</CardTitle>
          {task.description && (
            <CardDescription className="max-w-3xl text-sm text-muted-foreground">
              {task.description}
            </CardDescription>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {priorityBadge && (
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', priorityBadge.tone)}>
                <Clock3 className="size-3.5" />
                {priorityBadge.label}
              </span>
            )}
            {category && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow"
                style={{ backgroundColor: category.color }}
              >
                <Tag className="size-3.5" />
                {category.name}
              </span>
            )}
            {task.energy_required && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {energyMap[task.energy_required]}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {task.status !== 'completed' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-green-600 hover:text-green-600 focus-visible:ring-green-500/40 dark:text-green-400"
              onClick={() => onComplete(task.id)}
            >
              <CheckCircle2 className="size-4" />
              <span className="sr-only">Complete task</span>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onEdit(task)}>
            <PencilLine className="size-4" />
            <span className="sr-only">Edit task</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Delete task</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {dueDate && (
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-muted-foreground" />
            <span>Due {dueDate}</span>
          </div>
        )}
        {task.estimated_duration && (
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-muted-foreground" />
            <span>{task.estimated_duration} min estimate</span>
          </div>
        )}
        {task.status && (
          <div className="flex items-center gap-2 capitalize">
            <CheckCircle2 className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{task.status.replace('_', ' ')}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between border-t border-border/80 bg-muted/40 py-4">
        <div className="text-xs text-muted-foreground">
          {createdDate && <span>Created {createdDate}</span>}
        </div>
      </CardFooter>
    </Card>
  )
}
