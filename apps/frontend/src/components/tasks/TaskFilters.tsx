import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' }
] as const

export type TaskFilterValue = (typeof FILTER_OPTIONS)[number]['value']

interface TaskFiltersProps {
  value: TaskFilterValue
  onChange: (value: TaskFilterValue) => void
}

export function TaskFilters({ value, onChange }: TaskFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTER_OPTIONS.map(option => (
        <Button
          key={option.value}
          size="sm"
          variant={value === option.value ? 'default' : 'outline'}
          className={cn('rounded-full px-4', value === option.value && 'shadow-md shadow-primary/25')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
