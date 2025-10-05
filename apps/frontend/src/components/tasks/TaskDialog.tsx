import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Category } from '@/lib/categoryService'
import type { Task } from '@/lib/taskService'

export type TaskFormValues = {
  title: string
  description: string
  category: string
  due_date: string
  priority: NonNullable<Task['priority']>
  energy_required: NonNullable<Task['energy_required']>
  estimated_duration: number
}

interface TaskDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  categories: Category[]
  initialTask?: Task | null
  onOpenChange: (open: boolean) => void
  onSubmit: (values: TaskFormValues) => void
}

const defaultValues: TaskFormValues = {
  title: '',
  description: '',
  category: '',
  due_date: '',
  priority: 'medium',
  energy_required: 'medium',
  estimated_duration: 30
}

export function TaskDialog({ open, mode, categories, initialTask, onOpenChange, onSubmit }: TaskDialogProps) {
  const [formValues, setFormValues] = useState<TaskFormValues>(defaultValues)

  useEffect(() => {
    if (open) {
      if (initialTask) {
        setFormValues({
          title: initialTask.title ?? '',
          description: initialTask.description ?? '',
          category: initialTask.category ?? '',
          due_date: initialTask.due_date ? initialTask.due_date.slice(0, 10) : '',
          priority: initialTask.priority ?? 'medium',
          energy_required: initialTask.energy_required ?? 'medium',
          estimated_duration: initialTask.estimated_duration ?? 30
        })
      } else {
        setFormValues(defaultValues)
      }
    }
  }, [open, initialTask])

  function handleChange<Key extends keyof TaskFormValues>(key: Key, value: TaskFormValues[Key]) {
    setFormValues(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(formValues)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create a new task' : 'Update task'}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {mode === 'create'
              ? 'Capture the essentials so Glyde can help you stay focused and on track.'
              : 'Tweak the details and keep your plan aligned with reality.'}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="task-title">
              Title<span className="text-destructive">*</span>
            </label>
            <Input
              id="task-title"
              required
              value={formValues.title}
              placeholder="Ship onboarding flow"
              onChange={event => handleChange('title', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="task-description">
              Description
            </label>
            <Textarea
              id="task-description"
              value={formValues.description}
              placeholder="Outline the key tasks and dependencies you need to tackle."
              onChange={event => handleChange('description', event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="task-category">
                Category
              </label>
              <select
                id="task-category"
                value={formValues.category}
                onChange={event => handleChange('category', event.target.value)}
                className="border-input text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2"
              >
                <option value="">No category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="task-due-date">
                Due date
              </label>
              <Input
                id="task-due-date"
                type="date"
                value={formValues.due_date}
                onChange={event => handleChange('due_date', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="task-priority">
                Priority
              </label>
              <select
                id="task-priority"
                value={formValues.priority}
                onChange={event => handleChange('priority', event.target.value as TaskFormValues['priority'])}
                className="border-input text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="task-energy">
                Energy required
              </label>
              <select
                id="task-energy"
                value={formValues.energy_required}
                onChange={event => handleChange('energy_required', event.target.value as TaskFormValues['energy_required'])}
                className="border-input text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="task-duration">
              Estimated duration (minutes)
            </label>
            <Input
              id="task-duration"
              type="number"
              min={5}
              step={5}
              value={formValues.estimated_duration}
              onChange={event => handleChange('estimated_duration', Number(event.target.value))}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{mode === 'create' ? 'Create task' : 'Save changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
