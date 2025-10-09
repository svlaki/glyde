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

function adjustColor(color: string, amount: number) {
  let hex = color.trim()

  if (hex.startsWith('#')) {
    hex = hex.slice(1)
  }

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(char => `${char}${char}`)
      .join('')
  }

  if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) {
    return color
  }

  const adjustChannel = (channel: number) => {
    const normalized = amount
    if (normalized < 0) {
      return Math.max(0, Math.min(255, Math.round(channel * (1 + normalized))))
    }
    return Math.max(0, Math.min(255, Math.round(channel + (255 - channel) * normalized)))
  }

  const r = adjustChannel(parseInt(hex.slice(0, 2), 16))
  const g = adjustChannel(parseInt(hex.slice(2, 4), 16))
  const b = adjustChannel(parseInt(hex.slice(4, 6), 16))

  return `#${[r, g, b]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')}`
}

function isLightColor(color: string) {
  let hex = color.trim()

  if (hex.startsWith('#')) {
    hex = hex.slice(1)
  }

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(char => `${char}${char}`)
      .join('')
  }

  if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) {
    return false
  }

  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  const srgb = [r, g, b].map(value =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  )

  const luminance = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]

  return luminance > 0.6
}

export function TaskCard({ task, category, onComplete, onEdit, onDelete }: TaskCardProps) {
  const dueDate = task.due_date ? dateFormatter.format(new Date(task.due_date)) : null
  const createdDate = task.created_at ? dateFormatter.format(new Date(task.created_at)) : null
  const priorityBadge = task.priority ? priorityMap[task.priority] : null
  const resolvedCategory: Category | undefined = category ?? (task.category_name && (task.category_color || task.color)
    ? {
        id: task.category_id ?? `task-category-${task.category_name}`,
        user_id: task.user_id,
        name: task.category_name,
        color: task.category_color || task.color || '#2563eb'
      }
    : undefined)
  const cardColor = resolvedCategory?.color || task.category_color || task.color
  const useLightText = cardColor ? !isLightColor(cardColor) : false
  const gradientBackground = cardColor
    ? `linear-gradient(135deg, ${adjustColor(cardColor, -0.12)} 0%, ${adjustColor(cardColor, 0.08)} 100%)`
    : undefined
  const accentBorderColor = cardColor ? adjustColor(cardColor, useLightText ? -0.28 : 0.22) : undefined
  const cardTextClass = cardColor
    ? useLightText
      ? 'text-white'
      : 'text-slate-900'
    : 'text-foreground'
  const subtleTextClass = cardColor
    ? useLightText
      ? 'text-white/80'
      : 'text-slate-900/80'
    : 'text-muted-foreground'
  const iconColorClass = cardColor
    ? useLightText
      ? 'text-white/80'
      : 'text-slate-900/70'
    : 'text-muted-foreground'
  const footerBackgroundClass = cardColor
    ? useLightText
      ? 'bg-white/10'
      : 'bg-black/5'
    : 'bg-muted/40'
  const footerBorderClass = cardColor
    ? useLightText
      ? 'border-t border-white/20'
      : 'border-t border-black/10'
    : 'border-t border-border/80'
  const controlButtonClass = cardColor
    ? useLightText
      ? 'text-white/80 hover:text-white focus-visible:ring-white/30'
      : 'text-slate-900/80 hover:text-slate-900 focus-visible:ring-slate-900/30'
    : undefined
  const deleteButtonClass = cardColor
    ? useLightText
      ? 'text-white/80 hover:text-white focus-visible:ring-white/30'
      : 'text-slate-900/80 hover:text-slate-900 focus-visible:ring-slate-900/30'
    : 'text-destructive hover:text-destructive'
  const completeButtonClass = cardColor
    ? useLightText
      ? 'text-emerald-200 hover:text-emerald-100 focus-visible:ring-emerald-200/40'
      : 'text-emerald-600 hover:text-emerald-700 focus-visible:ring-emerald-600/40'
    : 'text-green-600 hover:text-green-600 focus-visible:ring-green-500/40 dark:text-green-400'
  const energyPillClass = cardColor
    ? useLightText
      ? 'bg-white/20 text-white/90'
      : 'bg-black/10 text-slate-900/80'
    : 'bg-secondary text-secondary-foreground'
  const categoryPillClass = cardColor
    ? useLightText
      ? 'bg-white/20 text-white'
      : 'bg-black/10 text-slate-900'
    : undefined
  const highlightOverlay = cardColor
    ? useLightText
      ? 'rgba(255,255,255,0.38)'
      : 'rgba(255,255,255,0.55)'
    : undefined
  const lowlightOverlay = cardColor
    ? useLightText
      ? 'rgba(0,0,0,0.25)'
      : 'rgba(0,0,0,0.12)'
    : undefined

  return (
    <Card
      elevation="sm"
      className={cn(
        'relative overflow-hidden border-border/70 transition-all duration-200',
        cardColor && 'border-transparent shadow-lg shadow-black/10 dark:shadow-black/20',
        cardTextClass,
        task.status === 'completed' && !cardColor && 'border-green-500/60 bg-green-500/5'
      )}
      style={cardColor ? { background: gradientBackground, borderColor: accentBorderColor } : undefined}
    >
      {cardColor && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(circle at 18% 20%, ${highlightOverlay}, transparent 55%), radial-gradient(circle at 82% 0%, ${lowlightOverlay}, transparent 55%)`
          }}
        />
      )}
      <CardHeader className="relative z-10 gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle className={cn('text-xl font-semibold', cardTextClass)}>{task.title}</CardTitle>
          {task.description && (
            <CardDescription className={cn('max-w-3xl text-sm', subtleTextClass)}>
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
            {resolvedCategory && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow',
                  cardColor ? categoryPillClass : 'text-white'
                )}
                style={cardColor ? undefined : { backgroundColor: resolvedCategory.color }}
              >
                <Tag className="size-3.5" />
                {resolvedCategory.name}
              </span>
            )}
            {task.energy_required && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                  energyPillClass
                )}
              >
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
              className={cn(completeButtonClass)}
              onClick={() => onComplete(task.id)}
            >
              <CheckCircle2 className="size-4" />
              <span className="sr-only">Complete task</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={cn(controlButtonClass)}
            onClick={() => onEdit(task)}
          >
            <PencilLine className="size-4" />
            <span className="sr-only">Edit task</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(deleteButtonClass)}
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Delete task</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn('relative z-10 grid gap-2 text-sm sm:grid-cols-2', subtleTextClass)}>
        {dueDate && (
          <div className="flex items-center gap-2">
            <Clock3 className={cn('size-4', iconColorClass)} />
            <span>Due {dueDate}</span>
          </div>
        )}
        {task.estimated_duration && (
          <div className="flex items-center gap-2">
            <Clock3 className={cn('size-4', iconColorClass)} />
            <span>{task.estimated_duration} min estimate</span>
          </div>
        )}
        {task.status && (
          <div className="flex items-center gap-2 capitalize">
            <CheckCircle2 className={cn('size-4', iconColorClass)} />
            <span className={cn('font-medium', cardTextClass)}>{task.status.replace('_', ' ')}</span>
          </div>
        )}
      </CardContent>
      <CardFooter
        className={cn(
          'relative z-10 flex justify-between py-4',
          footerBackgroundClass,
          footerBorderClass,
          subtleTextClass
        )}
      >
        <div className="text-xs">
          {createdDate && <span>Created {createdDate}</span>}
        </div>
      </CardFooter>
    </Card>
  )
}
