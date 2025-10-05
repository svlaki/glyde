import { useEffect, useMemo, useState } from 'react'
import { PlusIcon } from 'lucide-react'

import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskDialog, type TaskFormValues } from '@/components/tasks/TaskDialog'
import { TaskEmptyState } from '@/components/tasks/TaskEmptyState'
import { TaskFilters, type TaskFilterValue } from '@/components/tasks/TaskFilters'
import { TaskSummary } from '@/components/tasks/TaskSummary'
import { Button } from '@/components/ui/button'
import { ListSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/authContext'
import type { Category } from '@/lib/categoryService'
import { fetchUserCategories } from '@/lib/categoryService'
import { supabase } from '@/lib/supabase'
import {
  type Task,
  completeUserTask,
  createUserTask,
  deleteUserTask,
  fetchUserTasks,
  updateUserTask
} from '@/lib/taskService'

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TaskFilterValue>('all')
  const [dialogState, setDialogState] = useState<{ mode: 'create' | 'edit'; task?: Task } | null>(null)

  useEffect(() => {
    if (user) {
      void loadTasks()
      void loadCategories()
    }
  }, [user, filter])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`tasks-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          void loadTasks()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user])

  async function loadTasks() {
    if (!user) return
    setLoading(true)
    const filters = filter !== 'all' ? { status: filter } : undefined
    const { tasks: fetchedTasks, error: fetchError } = await fetchUserTasks(user, filters)
    if (fetchError) {
      setError(fetchError)
      setTasks([])
    } else {
      setError(null)
      setTasks(fetchedTasks)
    }
    setLoading(false)
  }

  async function loadCategories() {
    if (!user) return
    const { categories: fetchedCategories } = await fetchUserCategories(user)
    setCategories(fetchedCategories)
  }

  async function handleCreateTask(values: TaskFormValues) {
    if (!user) return
    const payload = transformFormValues(values)
    const { error: createError } = await createUserTask(user, payload)
    if (createError) {
      setError(createError)
      return
    }
    setDialogState(null)
    await loadTasks()
  }

  async function handleUpdateTask(taskId: string, values: TaskFormValues) {
    if (!user) return
    const payload = transformFormValues(values)
    const { error: updateError } = await updateUserTask(user, taskId, payload)
    if (updateError) {
      setError(updateError)
      return
    }
    setDialogState(null)
    await loadTasks()
  }

  async function handleDeleteTask(taskId: string) {
    if (!user) return
    if (!confirm('Are you sure you want to delete this task?')) return
    const { error: deleteError } = await deleteUserTask(user, taskId)
    if (deleteError) {
      setError(deleteError)
      return
    }
    await loadTasks()
  }

  async function handleCompleteTask(taskId: string) {
    if (!user) return
    const { error: completeError } = await completeUserTask(user, taskId)
    if (completeError) {
      setError(completeError)
      return
    }
    await loadTasks()
  }

  const categoryMap = useMemo(() => {
    return new Map(categories.map(category => [category.name, category]))
  }, [categories])

  const currentDialogTask = dialogState?.task ?? null
  const isDialogOpen = Boolean(dialogState)

  const headerActions = (
    <Button onClick={() => setDialogState({ mode: 'create' })} className="gap-2 px-5 shadow-sm">
      <PlusIcon className="size-4" />
      New task
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Task command center"
        description="Plan, prioritize, and track every commitment with a workspace designed to keep momentum high and context clear."
        actions={headerActions}
      />

      <div className="space-y-8">
        <TaskSummary tasks={tasks} />

        <section className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Your tasks</h2>
              <p className="text-sm text-muted-foreground">
                Filter by focus state and keep an eye on what needs your energy next.
              </p>
            </div>
            <TaskFilters value={filter} onChange={nextFilter => setFilter(nextFilter)} />
          </div>

          {error && (
            <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            {loading ? (
              <ListSkeleton count={3} />
            ) : tasks.length === 0 ? (
              <TaskEmptyState onCreate={() => setDialogState({ mode: 'create' })} />
            ) : (
              tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  category={task.category ? categoryMap.get(task.category) ?? undefined : undefined}
                  onComplete={handleCompleteTask}
                  onEdit={taskToEdit => setDialogState({ mode: 'edit', task: taskToEdit })}
                  onDelete={handleDeleteTask}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <TaskDialog
        open={isDialogOpen}
        mode={dialogState?.mode ?? 'create'}
        categories={categories}
        initialTask={currentDialogTask}
        onOpenChange={open => {
          if (!open) setDialogState(null)
        }}
        onSubmit={values => {
          if (dialogState?.mode === 'edit' && dialogState.task) {
            void handleUpdateTask(dialogState.task.id, values)
          } else {
            void handleCreateTask(values)
          }
        }}
      />
    </PageContainer>
  )
}

function transformFormValues(values: TaskFormValues) {
  return {
    title: values.title,
    description: values.description || undefined,
    category: values.category || undefined,
    due_date: values.due_date || undefined,
    priority: values.priority,
    energy_required: values.energy_required,
    estimated_duration: values.estimated_duration || 30
  }
}
