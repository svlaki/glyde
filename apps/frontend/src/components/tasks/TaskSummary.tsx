import { CheckCircle2, Clock3, ListTodo, Timer } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Task } from '@/lib/taskService'

interface TaskSummaryProps {
  tasks: Task[]
}

export function TaskSummary({ tasks }: TaskSummaryProps) {
  const total = tasks.length
  const completed = tasks.filter(task => task.status === 'completed').length
  const inProgress = tasks.filter(task => task.status === 'in_progress').length
  const pending = tasks.filter(task => task.status === 'pending').length

  const stats = [
    {
      label: 'Total tasks',
      value: total,
      icon: ListTodo,
      accent: 'bg-primary/10 text-primary'
    },
    {
      label: 'In progress',
      value: inProgress,
      icon: Timer,
      accent: 'bg-amber-500/10 text-amber-500'
    },
    {
      label: 'Pending review',
      value: pending,
      icon: Clock3,
      accent: 'bg-sky-500/10 text-sky-500'
    },
    {
      label: 'Completed',
      value: completed,
      icon: CheckCircle2,
      accent: 'bg-emerald-500/10 text-emerald-500'
    }
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(stat => (
        <Card key={stat.label} elevation="sm" className="border border-border/60 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            <span className={`inline-flex size-10 items-center justify-center rounded-full ${stat.accent}`}>
              <stat.icon className="size-5" />
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
