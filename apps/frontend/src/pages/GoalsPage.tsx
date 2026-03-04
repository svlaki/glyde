import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { fetchUserGoals, createUserGoal, updateUserGoal, deleteUserGoal } from '../lib/goalService'
import type { Goal } from '../lib/goalService'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { GoalCard } from '../components/GoalCard'
import { GoalDetailPanel } from '../components/GoalDetailPanel'
import { GoalForm } from '../components/GoalForm'
import { EmptyState } from '../components/EmptyState'
import { getColors } from '../styles/colors'
import { supabase } from '../lib/supabase'

export function GoalsPage() {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined)
  const selectedGoalIdRef = useRef<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Keep selected goal ID ref in sync
  useEffect(() => {
    selectedGoalIdRef.current = selectedGoal?.id || null
  }, [selectedGoal])

  // Load goals and realtime subscription - all in one effect like Calendar
  useEffect(() => {
    if (!user || !session) return

    let isSubscribed = true
    let refreshTimer: NodeJS.Timeout | null = null

    const loadGoals = async () => {
      if (!isSubscribed) return

      setLoading(true)
      setError(null)
      try {
        const { goals: userGoals, error: fetchError } = await fetchUserGoals(user, session.access_token, {})

        if (!isSubscribed) return

        if (fetchError) {
          setError(fetchError)
        } else {
          setGoals(userGoals || [])
          // Update selectedGoal with fresh data
          const currentSelectedId = selectedGoalIdRef.current
          if (currentSelectedId && userGoals) {
            const updatedSelected = userGoals.find(g => g.id === currentSelectedId)
            if (updatedSelected) {
              setSelectedGoal(updatedSelected)
            }
          } else if (!currentSelectedId && userGoals && userGoals.length > 0) {
            setSelectedGoal(userGoals[0])
          }
        }
      } catch (err: any) {
        if (isSubscribed) {
          setError(err.message || 'Failed to load goals')
        }
      } finally {
        if (isSubscribed) {
          setLoading(false)
        }
      }
    }

    loadGoals()

    // Realtime subscription
    const channel = supabase
      .channel(`goals-page-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[GoalsPage] Real-time goals change:', payload.eventType)
          // Debounce: clear existing timer and set new one
          if (refreshTimer) {
            clearTimeout(refreshTimer)
          }
          refreshTimer = setTimeout(() => {
            loadGoals()
          }, 500)
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }
      supabase.removeChannel(channel)
    }
  }, [user, session, refreshKey])

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
      // Realtime will refresh the list
    } catch (error) {
      console.error('Error deleting goal:', error)
      alert('Failed to delete goal. Please try again.')
    }
  }

  const handleSaveGoal = async (goalData: Partial<Goal>) => {
    if (!user || !session) return

    try {
      if (goalData.id) {
        // Update existing goal - pass all fields from the form
        const { id, ...updates } = goalData
        await updateUserGoal(user, session.access_token, id, updates)
      } else {
        // Create new goal
        if (!goalData.title) {
          throw new Error('Goal title is required')
        }
        await createUserGoal(user, session.access_token, {
          title: goalData.title,
          description: goalData.description,
          aspect: goalData.aspect,
        })
      }
      // Realtime will refresh the list
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
      overflow: 'hidden',
      background: colors.bgSecondary
    }}>
      {/* Vertical Sidebar */}
      <VerticalSidebar />

      {/* Main Content - offset by sidebar width */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0,
        marginLeft: `${SIDEBAR_WIDTH}px`,
      }}>
        {/* Left Panel - Goals List */}
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
            onUpdate={() => setRefreshKey(k => k + 1)}
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
