import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
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

  useEffect(() => {
    if (user) {
      loadTasks()
      loadCategories()
    }
  }, [user, filter])

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
    const { categories: fetchedCategories } = await fetchUserCategories(user, 'tasks')
    setCategories(fetchedCategories)
  }

  async function handleCreateTask(taskData: Partial<Task>) {
    if (!user) return
    const { task, error } = await createUserTask(user, taskData as any)
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
              onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
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
              onChange={e => setFormData({ ...formData, energy_required: e.target.value as any })}
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
