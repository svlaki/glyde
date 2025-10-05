import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'
import {
  fetchUserGoals,
  createUserGoal,
  updateUserGoal,
  deleteUserGoal,
  fetchGoalCheckIns,
  Goal,
  GoalCheckIn
} from '../lib/goalService'
import { fetchUserCategories, Category } from '../lib/categoryService'

export default function GoalsPage() {
  const { user } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [checkInGoal, setCheckInGoal] = useState<Goal | null>(null)
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null)
  const [goalCheckIns, setGoalCheckIns] = useState<GoalCheckIn[]>([])
  const [loadingCheckIns, setLoadingCheckIns] = useState(false)

  useEffect(() => {
    if (user) {
      loadGoals()
      loadCategories()
    }
  }, [user, filter])

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
  }, [user])

  const goalInsights = useMemo(() => calculateGoalInsights(goals), [goals])

  async function loadGoals(options: { showLoading?: boolean } = {}) {
    if (!user) return
    const showLoading = options.showLoading ?? true
    if (showLoading) {
      setLoading(true)
    }
    const filters = filter !== 'all' ? { status: filter } : undefined
    const { goals: fetchedGoals, error } = await fetchUserGoals(user, filters)
    if (error) {
      setError(error)
    } else {
      setGoals(fetchedGoals)
    }
    if (showLoading) {
      setLoading(false)
    }
  }

  async function loadCategories() {
    if (!user) return
    const { categories: fetchedCategories } = await fetchUserCategories(user)
    setCategories(fetchedCategories)
  }

  async function handleCreateGoal(goalData: Partial<Goal>) {
    if (!user) return
    const { error } = await createUserGoal(user, goalData as any)
    if (error) {
      setError(error)
    } else {
      await loadGoals()
      setShowCreateModal(false)
    }
  }

  async function handleUpdateGoal(goalId: string, updates: Partial<Goal>) {
    if (!user) return
    const { error } = await updateUserGoal(user, goalId, updates)
    if (error) {
      setError(error)
    } else {
      await loadGoals()
      setEditingGoal(null)
    }
  }

  async function handleDeleteGoal(goalId: string) {
    if (!user) return
    if (!confirm('Are you sure you want to delete this goal?')) return
    const { error } = await deleteUserGoal(user, goalId)
    if (error) {
      setError(error)
    } else {
      await loadGoals()
    }
  }

  async function handleViewProgress(goal: Goal) {
    if (!user) return
    setProgressGoal(goal)
    setLoadingCheckIns(true)
    const { checkIns, error } = await fetchGoalCheckIns(user, goal.id, 10)
    if (error) {
      setError(error)
      setGoalCheckIns([])
    } else {
      const sortedCheckIns = [...checkIns].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA
      })
      setGoalCheckIns(sortedCheckIns)
    }
    setLoadingCheckIns(false)
  }

  async function handleCheckInSaved(goalId: string) {
    await loadGoals({ showLoading: false })
    if (user && progressGoal && progressGoal.id === goalId) {
      const { checkIns } = await fetchGoalCheckIns(user, goalId, 10)
      const sortedCheckIns = [...checkIns].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA
      })
      setGoalCheckIns(sortedCheckIns)
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

      {goalInsights.totalGoals > 0 && (
        <GoalInsights insights={goalInsights} onCreateGoal={() => setShowCreateModal(true)} />
      )}

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
              onViewProgress={handleViewProgress}
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
          onSaved={handleCheckInSaved}
        />
      )}

      {progressGoal && (
        <GoalProgressModal
          goal={progressGoal}
          checkIns={goalCheckIns}
          loading={loadingCheckIns}
          onClose={() => {
            setProgressGoal(null)
            setGoalCheckIns([])
          }}
          onRequestCheckIn={() => setCheckInGoal(progressGoal)}
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
  onCheckIn,
  onViewProgress
}: {
  goal: Goal
  categories: Category[]
  onEdit: (goal: Goal) => void
  onDelete: (id: string) => void
  onCheckIn: (goal: Goal) => void
  onViewProgress: (goal: Goal) => void
}) {
  const category = categories.find(c => c.name === goal.category)
  const progress = goal.progress || 0
  const statusStyles: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    on_hold: 'bg-yellow-100 text-yellow-800',
    abandoned: 'bg-red-100 text-red-800'
  }
  const nextReview = getNextReviewDate(goal)
  const reviewIsSoon = nextReview ? nextReview <= addDays(new Date(), 3) : false

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">{goal.title}</h3>
          <div className="flex items-center gap-2">
            {goal.status && (
              <span className={`rounded-full px-2 py-1 text-xs capitalize ${statusStyles[goal.status] || 'bg-gray-100 text-gray-600'}`}>
                {goal.status.replace('_', ' ')}
              </span>
            )}
            {goal.goal_type && (
              <span className="text-xs text-gray-500 uppercase">{goal.goal_type}</span>
            )}
          </div>
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

      {nextReview && (
        <div className={`mb-3 text-sm ${reviewIsSoon ? 'text-orange-600' : 'text-gray-500'}`}>
          Next review: {nextReview.toLocaleDateString()} {reviewIsSoon && '(coming up)'}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onViewProgress(goal)}
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          Progress
        </button>
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

function CheckInModal({ goal, onClose, onSaved }: { goal: Goal; onClose: () => void; onSaved?: (goalId: string) => Promise<void> | void }) {
  const { user } = useAuth()
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
    if (!user) return

    const checkInData = {
      ...formData,
      wins_and_progress: formData.wins_and_progress ? [formData.wins_and_progress] : [],
      obstacles_encountered: formData.obstacles_encountered ? [formData.obstacles_encountered] : [],
      next_steps: formData.next_steps ? [formData.next_steps] : []
    }

    const { error } = await addGoalCheckIn(user, goal.id, checkInData)
    if (!error) {
      if (onSaved) {
        await onSaved(goal.id)
      }
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

function GoalProgressModal({
  goal,
  checkIns,
  loading,
  onClose,
  onRequestCheckIn
}: {
  goal: Goal
  checkIns: GoalCheckIn[]
  loading: boolean
  onClose: () => void
  onRequestCheckIn: () => void
}) {
  const latestCheckIn = checkIns[0]
  const previousCheckIn = checkIns[1]
  const progressDelta = latestCheckIn && previousCheckIn && latestCheckIn.progress_update !== undefined && previousCheckIn.progress_update !== undefined
    ? latestCheckIn.progress_update - previousCheckIn.progress_update
    : null

  const averageMood = checkIns.length
    ? Math.round(
        checkIns.reduce((total, item) => total + (item.mood_rating || 0), 0) /
          checkIns.length
      )
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{goal.title}</h2>
            <p className="mt-1 text-sm text-gray-500">Progress insights and check-in history</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Current progress</p>
            <p className="mt-2 text-2xl font-semibold">{goal.progress ?? 0}%</p>
            {progressDelta !== null && (
              <p className={`mt-1 text-xs ${progressDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {progressDelta >= 0 ? '+' : ''}{progressDelta}% since last check-in
              </p>
            )}
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Check-ins logged</p>
            <p className="mt-2 text-2xl font-semibold">{checkIns.length}</p>
            <button
              onClick={onRequestCheckIn}
              className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Log a new check-in
            </button>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Average mood</p>
            <p className="mt-2 text-2xl font-semibold">{averageMood ?? '—'}</p>
            <p className="mt-1 text-xs text-gray-500">Across recent reflections</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700">Timeline</h3>
          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Loading check-ins...</p>
          ) : checkIns.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
              No check-ins yet. Capture a quick reflection to start building momentum.
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {checkIns.map(checkIn => (
                <li key={checkIn.id} className="rounded-lg border bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {checkIn.created_at ? new Date(checkIn.created_at).toLocaleString() : 'Check-in'}
                    </p>
                    {checkIn.progress_update !== undefined && (
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-600">
                        Progress {checkIn.progress_update}%
                      </span>
                    )}
                  </div>
                  {(checkIn.wins_and_progress?.length || checkIn.next_steps?.length) && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {checkIn.wins_and_progress && checkIn.wins_and_progress.length > 0 && (
                        <div>
                          <p className="text-xs font-medium uppercase text-gray-500">Wins</p>
                          <ul className="mt-1 space-y-1 text-xs text-gray-600">
                            {checkIn.wins_and_progress.map((item, index) => (
                              <li key={index}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {checkIn.next_steps && checkIn.next_steps.length > 0 && (
                        <div>
                          <p className="text-xs font-medium uppercase text-gray-500">Next steps</p>
                          <ul className="mt-1 space-y-1 text-xs text-gray-600">
                            {checkIn.next_steps.map((item, index) => (
                              <li key={index}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {checkIn.obstacles_encountered && checkIn.obstacles_encountered.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium uppercase text-gray-500">Obstacles</p>
                      <ul className="mt-1 space-y-1 text-xs text-gray-600">
                        {checkIn.obstacles_encountered.map((item, index) => (
                          <li key={index}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {checkIn.reflection_notes && (
                    <p className="mt-3 text-xs italic text-gray-600">“{checkIn.reflection_notes}”</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

interface GoalInsightsData {
  totalGoals: number
  activeGoals: number
  averageProgress: number
  upcomingReviews: number
  lowMomentumGoals: number
  focusGoal: Goal | null
  upcomingFocus: Goal[]
}

function GoalInsights({ insights, onCreateGoal }: { insights: GoalInsightsData; onCreateGoal: () => void }) {
  const formatter = useMemo(
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
        <InsightCard title="Active goals" value={insights.activeGoals} helper="In motion right now" />
        <InsightCard title="Avg. progress" value={`${insights.averageProgress}%`} helper="Across all goals" />
        <InsightCard title="Upcoming reviews" value={insights.upcomingReviews} helper="Within 2 weeks" />
        <InsightCard title="Momentum alerts" value={insights.lowMomentumGoals} helper="Need extra focus" />
      </div>

      {insights.focusGoal && (
        <div className="rounded-xl border bg-purple-50 p-4 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium text-purple-700">Recommended focus goal</p>
              <p className="mt-1 text-xl font-semibold text-purple-900">{insights.focusGoal.title}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-purple-800">
                {insights.focusGoal.progress !== undefined && (
                  <span className="rounded-full bg-purple-100 px-3 py-1">
                    {insights.focusGoal.progress}% complete
                  </span>
                )}
                {insights.focusGoal.target_date && (
                  <span className="rounded-full bg-purple-100 px-3 py-1">
                    Target {formatter.format(new Date(insights.focusGoal.target_date))}
                  </span>
                )}
                {insights.focusGoal.energy_requirement && (
                  <span className="rounded-full bg-purple-100 px-3 py-1 capitalize">
                    Energy: {insights.focusGoal.energy_requirement}
                  </span>
                )}
              </div>
              {insights.focusGoal.description && (
                <p className="mt-2 max-w-3xl text-sm text-purple-900/80">
                  {insights.focusGoal.description}
                </p>
              )}
            </div>
            <button
              onClick={onCreateGoal}
              className="self-start rounded-lg border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-700 transition hover:bg-purple-100"
            >
              Add supporting milestone
            </button>
          </div>
        </div>
      )}

      {insights.upcomingFocus.length > 0 && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Upcoming focus window</h2>
            <span className="text-xs text-gray-500">Next 14 days</span>
          </div>
          <ul className="space-y-3">
            {insights.upcomingFocus.slice(0, 4).map(goal => (
              <li key={goal.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{goal.title}</p>
                  <p className="text-xs text-gray-500">Progress {goal.progress ?? 0}%</p>
                </div>
                {goal.target_date && (
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    {formatter.format(new Date(goal.target_date))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function InsightCard({ title, value, helper }: { title: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </div>
  )
}

function calculateGoalInsights(goals: Goal[]): GoalInsightsData {
  if (!goals || goals.length === 0) {
    return {
      totalGoals: 0,
      activeGoals: 0,
      averageProgress: 0,
      upcomingReviews: 0,
      lowMomentumGoals: 0,
      focusGoal: null,
      upcomingFocus: []
    }
  }

  const now = new Date()
  const activeGoals = goals.filter(goal => goal.status !== 'completed' && goal.status !== 'abandoned')
  const averageProgress = Math.round(
    goals.reduce((total, goal) => total + (goal.progress || 0), 0) / goals.length
  )
  const upcomingFocus = activeGoals
    .filter(goal => {
      if (!goal.target_date) return false
      const target = new Date(goal.target_date)
      return target >= now && target <= addDays(now, 14)
    })
    .sort((a, b) => {
      if (!a.target_date) return 1
      if (!b.target_date) return -1
      return new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
    })

  const lowMomentumGoals = upcomingFocus.filter(goal => (goal.progress || 0) < 40).length
  const upcomingReviews = activeGoals.filter(goal => {
    const nextReview = getNextReviewDate(goal)
    if (!nextReview) return false
    return nextReview <= addDays(now, 14)
  }).length

  const focusGoal = upcomingFocus.find(goal => (goal.progress || 0) < 60) || activeGoals[0] || null

  return {
    totalGoals: goals.length,
    activeGoals: activeGoals.length,
    averageProgress,
    upcomingReviews,
    lowMomentumGoals,
    focusGoal,
    upcomingFocus
  }
}

function getNextReviewDate(goal: Goal) {
  const frequency = goal.review_frequency || 'weekly'
  const mostRecent = goal.updated_at || goal.created_at
  if (!mostRecent) return null
  const baseDate = new Date(mostRecent)
  const increments: Record<string, number> = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90
  }
  const days = increments[frequency] ?? 7
  return addDays(baseDate, days)
}

function addDays(date: Date | string, days: number) {
  const base = typeof date === 'string' ? new Date(date) : new Date(date)
  const result = new Date(base)
  result.setDate(result.getDate() + days)
  return result
}
