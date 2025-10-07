import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'
import { fetchUserGoals, createUserGoal, updateUserGoal, deleteUserGoal, addGoalCheckIn, Goal } from '../lib/goalService'
import { fetchUserCategories, Category } from '../lib/categoryService'
import { validateRequired, formatErrorMessage, debounce } from '../lib/apiUtils'
import { usePerformanceMonitor } from '../lib/performance'

export default function GoalsPage() {
  const { user, session } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [checkInGoal, setCheckInGoal] = useState<Goal | null>(null)
  
  // Performance monitoring
  const { endRender } = usePerformanceMonitor('GoalsPage')

  // Memoized filtered goals for performance
  const filteredGoals = useMemo(() => {
    if (filter === 'all') return goals;
    return goals.filter(goal => goal.status === filter);
  }, [goals, filter]);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((searchTerm: string) => {
      // Implement search logic here if needed
      console.log('Searching for:', searchTerm);
    }, 300),
    []
  );

  const loadGoals = useCallback(async () => {
    if (!user || !session?.access_token) return

    setLoading(true)
    setError(null) // Clear previous errors

    try {
      const filters = filter !== 'all' ? { status: filter } : undefined
      const { goals: fetchedGoals, error } = await fetchUserGoals(user, session.access_token, filters)
      
      if (error) {
        setError(formatErrorMessage(error))
      } else {
        setGoals(fetchedGoals)
      }
    } catch (err) {
      console.error('Error loading goals:', err)
      setError('Failed to load goals. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user, session, filter])

  const loadCategories = useCallback(async () => {
    if (!user) return
    
    try {
      const { categories: fetchedCategories, error } = await fetchUserCategories(user)
      if (error) {
        console.error('Error loading categories:', error)
        // Don't set error state for categories as it's not critical
      } else {
        setCategories(fetchedCategories)
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadGoals()
      loadCategories()
    }
  }, [user, loadGoals, loadCategories])

  // Performance monitoring
  useEffect(() => {
    endRender();
  });

  // Real-time subscription for goals
  useEffect(() => {
    if (!user) return

    const channel = supabase.channel(`goals-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'goals',
        filter: `user_id=eq.${user.id}`
      }, () => {
        loadGoals()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, loadGoals])

  const handleCreateGoal = useCallback(async (goalData: Partial<Goal>) => {
    if (!user || !session?.access_token) return

    setIsCreating(true)
    setError(null) // Clear previous errors

    try {
      // Validate required fields
      const validationError = validateRequired(goalData, ['title'])
      if (validationError) {
        setError(validationError)
        return
      }

      const { goal, error } = await createUserGoal(user, session.access_token, goalData as any)
      if (error) {
        setError(formatErrorMessage(error))
      } else if (goal) {
        await loadGoals()
        setShowCreateModal(false)
      } else {
        setError('Failed to create goal - no data returned')
      }
    } catch (err) {
      console.error('Error creating goal:', err)
      setError('Failed to create goal. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }, [user, session, loadGoals])

  async function handleUpdateGoal(goalId: string, updates: Partial<Goal>) {
    if (!user || !session?.access_token) return
    const { error } = await updateUserGoal(user, session.access_token, goalId, updates)
    if (error) {
      setError(error)
    } else {
      await loadGoals()
      setEditingGoal(null)
    }
  }

  async function handleDeleteGoal(goalId: string) {
    if (!user || !session?.access_token) return
    if (!confirm('Are you sure you want to delete this goal?')) return
    const { error } = await deleteUserGoal(user, session.access_token, goalId)
    if (error) {
      setError(error)
    } else {
      await loadGoals()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading goals...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Goals</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Goal
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
          onClick={() => setFilter('not_started')}
          className={`px-4 py-2 rounded ${filter === 'not_started' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Not Started
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No goals found. Create your first goal!
          </div>
        ) : (
          goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              categories={categories}
              onEdit={setEditingGoal}
              onDelete={handleDeleteGoal}
              onCheckIn={setCheckInGoal}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <GoalModal
          categories={categories}
          onSave={handleCreateGoal}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingGoal && (
        <GoalModal
          goal={editingGoal}
          categories={categories}
          onSave={(updates) => handleUpdateGoal(editingGoal.id, updates)}
          onClose={() => setEditingGoal(null)}
        />
      )}

      {checkInGoal && (
        <CheckInModal
          goal={checkInGoal}
          onClose={() => setCheckInGoal(null)}
        />
      )}
    </div>
  )
}

function GoalCard({
  goal,
  categories,
  onEdit,
  onDelete,
  onCheckIn
}: {
  goal: Goal
  categories: Category[]
  onEdit: (goal: Goal) => void
  onDelete: (id: string) => void
  onCheckIn: (goal: Goal) => void
}) {
  const category = categories.find(c => c.name === goal.category)
  const progress = goal.progress || 0

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">{goal.title}</h3>
          <span className="text-xs text-gray-500">{goal.goal_type}</span>
        </div>
        {category && (
          <span
            className="inline-block px-2 py-1 rounded text-xs text-white"
            style={{ backgroundColor: category.color }}
          >
            {category.name}
          </span>
        )}
      </div>

      {goal.description && (
        <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
      )}

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {goal.target_date && (
        <div className="text-sm text-gray-500 mb-3">
          Target: {new Date(goal.target_date).toLocaleDateString()}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onCheckIn(goal)}
          className="text-sm text-green-600 hover:text-green-800"
        >
          Check-in
        </button>
        <button
          onClick={() => onEdit(goal)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(goal.id)}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function GoalModal({
  goal,
  categories,
  onSave,
  onClose
}: {
  goal?: Goal
  categories: Category[]
  onSave: (goal: Partial<Goal>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    category: goal?.category || '',
    target_date: goal?.target_date || '',
    goal_type: goal?.goal_type || 'smart',
    progress: goal?.progress || 0,
    energy_requirement: goal?.energy_requirement || 'medium',
    review_frequency: goal?.review_frequency || 'weekly'
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">{goal ? 'Edit Goal' : 'Create Goal'}</h2>
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
            <label className="block text-sm font-medium mb-1">Goal Type</label>
            <select
              value={formData.goal_type}
              onChange={e => setFormData({ ...formData, goal_type: e.target.value as any })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="smart">SMART</option>
              <option value="okr">OKR</option>
              <option value="milestone">Milestone</option>
              <option value="habit">Habit</option>
              <option value="project">Project</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Target Date</label>
            <input
              type="date"
              value={formData.target_date}
              onChange={e => setFormData({ ...formData, target_date: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Progress: {formData.progress}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.progress}
              onChange={e => setFormData({ ...formData, progress: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Energy Requirement</label>
            <select
              value={formData.energy_requirement}
              onChange={e => setFormData({ ...formData, energy_requirement: e.target.value as any })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Review Frequency</label>
            <select
              value={formData.review_frequency}
              onChange={e => setFormData({ ...formData, review_frequency: e.target.value as any })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
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
              {goal ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CheckInModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { user, session } = useAuth()
  const [formData, setFormData] = useState({
    progress_update: goal.progress || 0,
    mood_rating: 5,
    confidence_level: 5,
    wins_and_progress: '',
    obstacles_encountered: '',
    next_steps: '',
    reflection_notes: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !session?.access_token) return

    const checkInData = {
      ...formData,
      wins_and_progress: formData.wins_and_progress ? [formData.wins_and_progress] : [],
      obstacles_encountered: formData.obstacles_encountered ? [formData.obstacles_encountered] : [],
      next_steps: formData.next_steps ? [formData.next_steps] : []
    }

    const { error } = await addGoalCheckIn(user, session.access_token, goal.id, checkInData)
    if (!error) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Goal Check-in: {goal.title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Progress: {formData.progress_update}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.progress_update}
              onChange={e => setFormData({ ...formData, progress_update: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Mood Rating: {formData.mood_rating}/10</label>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.mood_rating}
              onChange={e => setFormData({ ...formData, mood_rating: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confidence Level: {formData.confidence_level}/10</label>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.confidence_level}
              onChange={e => setFormData({ ...formData, confidence_level: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Wins & Progress</label>
            <textarea
              value={formData.wins_and_progress}
              onChange={e => setFormData({ ...formData, wins_and_progress: e.target.value })}
              className="w-full border rounded px-3 py-2"
              rows={2}
              placeholder="What went well?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Obstacles Encountered</label>
            <textarea
              value={formData.obstacles_encountered}
              onChange={e => setFormData({ ...formData, obstacles_encountered: e.target.value })}
              className="w-full border rounded px-3 py-2"
              rows={2}
              placeholder="What challenges did you face?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Next Steps</label>
            <textarea
              value={formData.next_steps}
              onChange={e => setFormData({ ...formData, next_steps: e.target.value })}
              className="w-full border rounded px-3 py-2"
              rows={2}
              placeholder="What will you do next?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reflection Notes</label>
            <textarea
              value={formData.reflection_notes}
              onChange={e => setFormData({ ...formData, reflection_notes: e.target.value })}
              className="w-full border rounded px-3 py-2"
              rows={3}
              placeholder="Any additional thoughts?"
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
              Save Check-in
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
