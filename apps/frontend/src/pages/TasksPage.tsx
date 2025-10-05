import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'
import { fetchUserTasks, createUserTask, updateUserTask, deleteUserTask, completeUserTask, Task } from '../lib/taskService'
import { fetchUserCategories, Category } from '../lib/categoryService'

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const taskInsights = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return {
        total: 0,
        pendingCount: 0,
        completedThisWeek: 0,
        overdueTasks: [] as Task[],
        dueTodayTasks: [] as Task[],
        upcomingDeadlines: [] as Task[],
        energyBuckets: getEmptyEnergyBuckets(),
        recommendedTask: null as Task | null
      }
    }

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const weekAgo = new Date(now)
    weekAgo.setDate(now.getDate() - 7)
    const pendingTasks = tasks.filter(task => task.status !== 'completed' && task.status !== 'cancelled')

    const overdueTasks = pendingTasks.filter(task =>
      task.due_date ? new Date(task.due_date) < startOfToday : false
    )

    const dueTodayTasks = pendingTasks.filter(task => {
      if (!task.due_date) return false
      const dueDate = new Date(task.due_date)
      return dueDate >= startOfToday && dueDate < endOfToday
    })

    const upcomingDeadlines = pendingTasks
      .filter(task => {
        if (!task.due_date) return false
        const dueDate = new Date(task.due_date)
        return dueDate >= endOfToday && dueDate <= addDays(now, 3)
      })
      .sort((a, b) => {
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })

    const completedThisWeek = tasks.filter(task => {
      if (task.status !== 'completed' || !task.completed_at) return false
      const completedDate = new Date(task.completed_at)
      return completedDate >= weekAgo
    }).length

    const priorityScore = { urgent: 4, high: 3, medium: 2, low: 1 } as const

    const recommendedTask = [...pendingTasks]
      .sort((a, b) => {
        const priorityA = priorityScore[a.priority || 'medium'] || 1
        const priorityB = priorityScore[b.priority || 'medium'] || 1

        if (priorityA !== priorityB) {
          return priorityB - priorityA
        }

        const dueA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
        const dueB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
        return dueA - dueB
      })
      .shift() || null

    const energyBuckets = ['low', 'medium', 'high'].map(level => {
      const levelTasks = pendingTasks.filter(task => (task.energy_required || 'medium') === level)
      const nextTask = [...levelTasks]
        .sort((a, b) => {
          const dueA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
          const dueB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
          return dueA - dueB
        })
        .shift() || null

      return {
        level: level as 'low' | 'medium' | 'high',
        count: levelTasks.length,
        nextTask
      }
    })

    return {
      total: tasks.length,
      pendingCount: pendingTasks.length,
      completedThisWeek,
      overdueTasks,
      dueTodayTasks,
      upcomingDeadlines,
      energyBuckets,
      recommendedTask
    }
  }, [tasks])

  useEffect(() => {
    if (user) {
      loadTasks()
      loadCategories()
    }
  }, [user, filter])

  // Real-time subscription for tasks
  useEffect(() => {
    if (!user) return

    const channel = supabase.channel(`tasks-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${user.id}`
      }, () => {
        loadTasks()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  async function loadTasks() {
    if (!user) return
    setLoading(true)
    const filters = filter !== 'all' ? { status: filter } : undefined
    const { tasks: fetchedTasks, error } = await fetchUserTasks(user, filters)
    if (error) {
      setError(error)
    } else {
      setTasks(fetchedTasks)
    }
    setLoading(false)
  }

  async function loadCategories() {
    if (!user) return
    const { categories: fetchedCategories } = await fetchUserCategories(user)
    setCategories(fetchedCategories)
  }

  async function handleCreateTask(taskData: Partial<Task>) {
    if (!user) return
    const { task, error } = await createUserTask(user, taskData as Required<Pick<Task, 'title'>> & Partial<Task>)
    if (error) {
      setError(error)
    } else {
      await loadTasks()
      setShowCreateModal(false)
    }
  }

  async function handleUpdateTask(taskId: string, updates: Partial<Task>) {
    if (!user) return
    const { error } = await updateUserTask(user, taskId, updates)
    if (error) {
      setError(error)
    } else {
      await loadTasks()
      setEditingTask(null)
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!user) return
    if (!confirm('Are you sure you want to delete this task?')) return
    const { error } = await deleteUserTask(user, taskId)
    if (error) {
      setError(error)
    } else {
      await loadTasks()
    }
  }

  async function handleCompleteTask(taskId: string) {
    if (!user) return
    const { error } = await completeUserTask(user, taskId)
    if (error) {
      setError(error)
    } else {
      await loadTasks()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading tasks...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Task
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {taskInsights.pendingCount > 0 && (
        <TaskInsights stats={taskInsights} onAddTask={() => setShowCreateModal(true)} />
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded ${filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('in_progress')}
          className={`px-4 py-2 rounded ${filter === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          In Progress
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded ${filter === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Completed
        </button>
      </div>

      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No tasks found. Create your first task!
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              categories={categories}
              onEdit={setEditingTask}
              onDelete={handleDeleteTask}
              onComplete={handleCompleteTask}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <TaskModal
          categories={categories}
          onSave={handleCreateTask}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingTask && (
        <TaskModal
          task={editingTask}
          categories={categories}
          onSave={(updates) => handleUpdateTask(editingTask.id, updates)}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}

function TaskCard({
  task,
  categories,
  onEdit,
  onDelete,
  onComplete
}: {
  task: Task
  categories: Category[]
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onComplete: (id: string) => void
}) {
  const category = categories.find(c => c.name === task.category)
  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  }

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold">{task.title}</h3>
            {task.priority && (
              <span className={`px-2 py-1 rounded text-xs ${priorityColors[task.priority]}`}>
                {task.priority}
              </span>
            )}
            {category && (
              <span
                className="px-2 py-1 rounded text-xs text-white"
                style={{ backgroundColor: category.color }}
              >
                {category.name}
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-gray-600 mb-2">{task.description}</p>
          )}
          <div className="flex gap-4 text-sm text-gray-500">
            {task.due_date && (
              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
            )}
            {task.energy_required && (
              <span>Energy: {task.energy_required}</span>
            )}
            {task.estimated_duration && (
              <span>Est: {task.estimated_duration}min</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {task.status !== 'completed' && (
            <button
              onClick={() => onComplete(task.id)}
              className="text-green-600 hover:text-green-800"
              title="Complete"
            >
              ✓
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            className="text-blue-600 hover:text-blue-800"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="text-red-600 hover:text-red-800"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

interface TaskInsightData {
  total: number
  pendingCount: number
  completedThisWeek: number
  overdueTasks: Task[]
  dueTodayTasks: Task[]
  upcomingDeadlines: Task[]
  energyBuckets: Array<{
    level: 'low' | 'medium' | 'high'
    count: number
    nextTask: Task | null
  }>
  recommendedTask: Task | null
}

function TaskInsights({ stats, onAddTask }: { stats: TaskInsightData; onAddTask: () => void }) {
  const totalUrgentItems = stats.overdueTasks.length + stats.dueTodayTasks.length
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric'
      }),
    []
  )

  return (
    <div className="mb-8 space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Active Tasks</p>
          <p className="mt-2 text-2xl font-semibold">{stats.pendingCount}</p>
          <p className="mt-1 text-xs text-gray-500">{stats.total} total tasks tracked</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Due Today</p>
          <p className="mt-2 text-2xl font-semibold">{stats.dueTodayTasks.length}</p>
          <p className="mt-1 text-xs text-gray-500">Stay ahead of today&apos;s commitments</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Overdue</p>
          <p className={`mt-2 text-2xl font-semibold ${totalUrgentItems > 0 ? 'text-red-600' : ''}`}>
            {stats.overdueTasks.length}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {totalUrgentItems > 0 ? 'Prioritize these first' : 'You are on track!'}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Completed (7d)</p>
          <p className="mt-2 text-2xl font-semibold">{stats.completedThisWeek}</p>
          <p className="mt-1 text-xs text-gray-500">Celebrate your recent wins</p>
        </div>
      </div>

      {stats.recommendedTask && (
        <div className="rounded-xl border bg-blue-50 p-4 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium text-blue-700">Next Best Action</p>
              <p className="mt-1 text-xl font-semibold text-blue-900">{stats.recommendedTask.title}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-blue-800">
                {stats.recommendedTask.priority && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 capitalize">
                    Priority: {stats.recommendedTask.priority}
                  </span>
                )}
                {stats.recommendedTask.energy_required && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 capitalize">
                    Energy: {stats.recommendedTask.energy_required}
                  </span>
                )}
                {stats.recommendedTask.estimated_duration && (
                  <span className="rounded-full bg-blue-100 px-3 py-1">
                    {stats.recommendedTask.estimated_duration} min
                  </span>
                )}
                {stats.recommendedTask.due_date && (
                  <span className="rounded-full bg-blue-100 px-3 py-1">
                    Due {dateFormatter.format(new Date(stats.recommendedTask.due_date))}
                  </span>
                )}
              </div>
              {stats.recommendedTask.description && (
                <p className="mt-2 max-w-3xl text-sm text-blue-900/80">
                  {stats.recommendedTask.description}
                </p>
              )}
            </div>
            <button
              onClick={onAddTask}
              className="self-start rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
            >
              Add supporting task
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Upcoming deadlines</h2>
            <span className="text-xs text-gray-500">Next 3 days</span>
          </div>
          {stats.upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-gray-500">No deadlines approaching. Consider scheduling focused work.</p>
          ) : (
            <ul className="space-y-3">
              {stats.upcomingDeadlines.slice(0, 4).map(task => (
                <li key={task.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.category && <p className="text-xs text-gray-500">{task.category}</p>}
                  </div>
                  {task.due_date && (
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {dateFormatter.format(new Date(task.due_date))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-base font-semibold">Energy planner</h2>
            <p className="text-xs text-gray-500">Match tasks to your current energy level</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.energyBuckets.map(bucket => (
              <div key={bucket.level} className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs uppercase text-gray-500">{bucket.level}</p>
                <p className="mt-1 text-xl font-semibold">{bucket.count}</p>
                {bucket.nextTask ? (
                  <p className="mt-2 text-xs text-gray-600">
                    Next: {bucket.nextTask.title}
                    {bucket.nextTask.due_date && (
                      <span className="block text-[11px] text-gray-400">
                        {dateFormatter.format(new Date(bucket.nextTask.due_date))}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">No tasks mapped</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getEmptyEnergyBuckets() {
  return [
    { level: 'low' as const, count: 0, nextTask: null },
    { level: 'medium' as const, count: 0, nextTask: null },
    { level: 'high' as const, count: 0, nextTask: null }
  ]
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function TaskModal({
  task,
  categories,
  onSave,
  onClose
}: {
  task?: Task
  categories: Category[]
  onSave: (task: Partial<Task>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    category: task?.category || '',
    due_date: task?.due_date || '',
    priority: task?.priority || 'medium',
    energy_required: task?.energy_required || 'medium',
    estimated_duration: task?.estimated_duration || 30
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">{task ? 'Edit Task' : 'Create Task'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded px-3 py-2"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">None</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <input
              type="date"
              value={formData.due_date}
              onChange={e => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              value={formData.priority}
              onChange={e => setFormData({ ...formData, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent' })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Energy Required</label>
            <select
              value={formData.energy_required}
              onChange={e => setFormData({ ...formData, energy_required: e.target.value as 'low' | 'medium' | 'high' })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Estimated Duration (minutes)</label>
            <input
              type="number"
              value={formData.estimated_duration}
              onChange={e => setFormData({ ...formData, estimated_duration: Number(e.target.value) })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {task ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
