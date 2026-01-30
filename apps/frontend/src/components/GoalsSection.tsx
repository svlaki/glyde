import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { fetchUserGoals, createUserGoal, updateUserGoal, deleteUserGoal, Goal } from '../lib/goalService'
import { GoalCard } from './GoalCard'
import { GoalDetailPanel } from './GoalDetailPanel'
import { GoalForm } from './GoalForm'
import { EmptyState } from './EmptyState'
import { getColors } from '../styles/colors'
import { usePlatform } from '../hooks/usePlatform'
import { supabase } from '../lib/supabase'

export function GoalsSection() {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined)
  // For mobile: track whether showing list or detail view
  const [showingDetail, setShowingDetail] = useState(false)
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
      .channel(`goals-section-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => {
            loadGoals()
          }, 500)
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      if (refreshTimer) clearTimeout(refreshTimer)
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
      // Realtime will refresh
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

      // Realtime will refresh the list
      setIsFormOpen(false)
    } catch (error) {
      console.error('Error saving goal:', error)
      throw error
    }
  }

  // Handle goal selection - on mobile, switch to detail view
  const handleGoalClick = (goal: Goal) => {
    setSelectedGoal(goal)
    if (isMobile) {
      setShowingDetail(true)
    }
  }

  // Handle back button on mobile detail view
  const handleBackToList = () => {
    setShowingDetail(false)
  }

  // Mobile layout - list OR detail
  if (isMobile) {
    return (
      <div style={{
        background: colors.bgPrimary,
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '6px',
        overflow: 'hidden'
      }}>
        {/* Section Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          background: colors.bgPrimary,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {showingDetail && selectedGoal ? (
            <>
              <button
                onClick={handleBackToList}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '400',
                  background: 'transparent',
                  color: colors.textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ← Back
              </button>
              <h2 style={{
                fontSize: '14px',
                fontWeight: '400',
                color: colors.textPrimary,
                margin: 0,
                flex: 1,
                textAlign: 'center'
              }}>
                Goal Details
              </h2>
              <div style={{ width: '60px' }} /> {/* Spacer for centering */}
            </>
          ) : (
            <>
              <h2 style={{
                fontSize: '14px',
                fontWeight: '400',
                color: colors.textPrimary,
                margin: 0
              }}>
                Goals
              </h2>
              <button
                onClick={handleCreateGoal}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '400',
                  background: 'transparent',
                  color: colors.textSecondary,
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                New
              </button>
            </>
          )}
        </div>

        {/* Mobile Content - List OR Detail */}
        {showingDetail && selectedGoal ? (
          <div style={{
            padding: '20px',
            background: colors.bgPrimary
          }}>
            <GoalDetailPanel
              goal={selectedGoal}
              onEdit={handleEditGoal}
              onUpdate={() => setRefreshKey(k => k + 1)}
              onDelete={() => {
                handleDeleteGoal()
                setShowingDetail(false)
              }}
            />
          </div>
        ) : (
          <div style={{
            padding: '16px',
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
                color: '#ef4444',
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
                  onClick={() => handleGoalClick(goal)}
                />
              ))
            )}
          </div>
        )}

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

  // Desktop layout - side by side
  return (
    <div style={{
      background: colors.bgPrimary,
      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      borderRadius: '6px',
      overflow: 'hidden'
    }}>
      {/* Section Header */}
      <div style={{
        padding: '20px',
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        background: colors.bgPrimary,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: '400',
          color: colors.textPrimary,
          margin: 0
        }}>
          Goals
        </h2>
        <button
          onClick={handleCreateGoal}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: '400',
            background: 'transparent',
            color: colors.textSecondary,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          New
        </button>
      </div>

      {/* Goals Content */}
      <div style={{
        display: 'flex',
        minHeight: '400px',
        maxHeight: '600px'
      }}>
        {/* Left - Goals List */}
        <div style={{
          width: '350px',
          borderRight: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          background: colors.bgPrimary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
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
                color: '#ef4444',
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

        {/* Right - Goal Details */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
          background: colors.bgPrimary
        }}>
          <GoalDetailPanel
            goal={selectedGoal}
            onEdit={handleEditGoal}
            onUpdate={() => setRefreshKey(k => k + 1)}
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
