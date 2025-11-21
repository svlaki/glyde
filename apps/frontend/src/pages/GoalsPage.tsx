import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { fetchUserGoals, createUserGoal, updateUserGoal, deleteUserGoal, Goal } from '../lib/goalService'
import { PageHeader } from '../components/PageHeader'
import { GoalCard } from '../components/GoalCard'
import { GoalDetailPanel } from '../components/GoalDetailPanel'
import { GoalForm } from '../components/GoalForm'
import { EmptyState } from '../components/EmptyState'
import { getColors } from '../styles/colors'

export function GoalsPage() {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined)
  useEffect(() => {
    loadGoals()
  }, [user, session])

  const loadGoals = async () => {
    if (!user || !session) return

    setLoading(true)
    setError(null)
    try {
      const { goals: userGoals, error: fetchError } = await fetchUserGoals(user, session.access_token, {})

      if (fetchError) {
        setError(fetchError)
      } else {
        setGoals(userGoals || [])
        // Select first goal if none selected
        if (!selectedGoal && userGoals && userGoals.length > 0) {
          setSelectedGoal(userGoals[0])
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load goals')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGoal = () => {
    setEditingGoal(undefined)
    setIsFormOpen(true)
  }

  const handleEditGoal = () => {
    if (!selectedGoal) return
    setEditingGoal(selectedGoal)
    setIsFormOpen(true)
  }

  const handleDeleteGoal = async () => {
    if (!selectedGoal || !user || !session) return

    try {
      await deleteUserGoal(user, session.access_token, selectedGoal.id!)
      setSelectedGoal(null)
      await loadGoals()
    } catch (error) {
      console.error('Error deleting goal:', error)
      alert('Failed to delete goal. Please try again.')
    }
  }

  const handleSaveGoal = async (goalData: Partial<Goal>) => {
    if (!user || !session) return

    console.log('handleSaveGoal called with:', goalData)

    try {
      if (goalData.id) {
        // Update existing goal
        console.log('Updating goal with category:', goalData.category)
        await updateUserGoal(user, session.access_token, goalData.id, {
          title: goalData.title,
          description: goalData.description,
          category: goalData.category
        })
      } else {
        // Create new goal
        if (!goalData.title) {
          throw new Error('Goal title is required')
        }
        console.log('Creating goal with category:', goalData.category)
        await createUserGoal(user, session.access_token, {
          title: goalData.title,
          description: goalData.description,
          category: goalData.category
        })
      }
      await loadGoals()
      setIsFormOpen(false)
    } catch (error) {
      console.error('Error saving goal:', error)
      throw error
    }
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: colors.bgSecondary
    }}>
      {/* Header */}
      <PageHeader />

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0
      }}>
        {/* Left Sidebar - Goals List */}
        <div style={{
          width: '350px',
          borderRight: `1px solid ${colors.border}`,
          background: colors.bgSecondary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Sidebar Header */}
          <div style={{
            padding: '20px',
            borderBottom: `1px solid ${colors.border}`,
            background: colors.bgSecondary
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.textPrimary,
                margin: 0
              }}>
                Goals
              </h2>
              <button
                onClick={handleCreateGoal}
                className="btn btn-primary"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px'
                }}
              >
                + New Goal
              </button>
            </div>
          </div>

          {/* Goals List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {loading ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: colors.textSecondary,
                fontSize: '14px'
              }}>
                Loading goals...
              </div>
            ) : error ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#c66',
                fontSize: '14px'
              }}>
                Error: {error}
              </div>
            ) : goals.length === 0 ? (
              <EmptyState
                title="No goals yet"
                description="Create your first goal to get started"
              />
            ) : (
              goals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  isSelected={selectedGoal?.id === goal.id}
                  onClick={() => setSelectedGoal(goal)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Content - Goal Details */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '30px'
        }}>
          <GoalDetailPanel
            goal={selectedGoal}
            onEdit={handleEditGoal}
            onDelete={handleDeleteGoal}
          />
        </div>
      </div>

      {/* Goal Form Modal */}
      <GoalForm
        goal={editingGoal}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveGoal}
      />
    </div>
  )
}
