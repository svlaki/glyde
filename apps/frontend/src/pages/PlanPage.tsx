import { useState, useEffect, useRef } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { useAuth } from '../lib/authContext'
import { PageHeader } from '../components/PageHeader'
import { PlanTimeline } from '../components/PlanTimeline'
import { ChatBot } from '../components/ChatBot'
import { getColors } from '../styles/colors'
import { fetchUserPlan, createUserPlan, updateUserPlan, LifePlan } from '../lib/planService'
import { fetchUserGoals, Goal } from '../lib/goalService'
import { supabase } from '../lib/supabase'

export function PlanPage() {
  const { isDarkMode } = useDarkMode()
  const { user, session } = useAuth()
  const colors = getColors(isDarkMode)

  const [plan, setPlan] = useState<LifePlan | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Load data and realtime subscriptions - all in one effect like Calendar
  useEffect(() => {
    if (!user || !session?.access_token) return

    let isSubscribed = true
    let refreshTimer: NodeJS.Timeout | null = null

    const loadData = async () => {
      if (!isSubscribed) return

      setIsLoading(true)
      setError(null)

      try {
        const [planResult, goalsResult] = await Promise.all([
          fetchUserPlan(user, session.access_token),
          fetchUserGoals(user, session.access_token)
        ])

        if (!isSubscribed) return

        if (planResult.error) {
          console.error('Error loading plan:', planResult.error)
        }
        if (goalsResult.error) {
          console.error('Error loading goals:', goalsResult.error)
        }

        setPlan(planResult.plan)
        setGoals(goalsResult.goals)
        setEditContent(planResult.plan?.content || '')
      } catch (err) {
        if (isSubscribed) {
          setError('Failed to load data')
          console.error(err)
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false)
        }
      }
    }

    loadData()

    // Realtime subscriptions
    const goalsChannel = supabase
      .channel(`plan-goals-${user.id}-${Date.now()}`)
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
          refreshTimer = setTimeout(() => loadData(), 500)
        }
      )
      .subscribe()

    const plansChannel = supabase
      .channel(`plan-life_plans-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'life_plans',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => loadData(), 500)
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(goalsChannel)
      supabase.removeChannel(plansChannel)
    }
  }, [user, session, refreshKey])

  // Create a new plan if none exists
  const handleCreatePlan = async () => {
    if (!user || !session?.access_token) return

    const result = await createUserPlan(user, session.access_token, {
      title: 'My Life Plan',
      content: '# My Life Plan\n\nDescribe your vision, priorities, and approach here...',
      status: 'active'
    })

    if (result.plan) {
      setPlan(result.plan)
      setEditContent(result.plan.content || '')
    } else if (result.error) {
      setError(result.error)
    }
  }

  // Auto-save plan content with debounce
  const handleContentChange = (newContent: string) => {
    setEditContent(newContent)

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !session?.access_token || !plan) return

      const result = await updateUserPlan(user, session.access_token, plan.id, {
        content: newContent
      })

      if (result.plan) {
        setPlan(result.plan)
      }
    }, 1000) // 1 second debounce
  }

  // Save on blur
  const handleBlur = async () => {
    setIsEditing(false)

    // Clear any pending timeout and save immediately
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    if (!user || !session?.access_token || !plan) return
    if (editContent === plan.content) return // No changes

    const result = await updateUserPlan(user, session.access_token, plan.id, {
      content: editContent
    })

    if (result.plan) {
      setPlan(result.plan)
    }
  }

  // Refresh goals after milestone update
  const handleMilestoneUpdate = () => {
    setRefreshKey(k => k + 1)
  }

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: colors.bgSecondary
      }}>
        <PageHeader />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textSecondary
        }}>
          Loading...
        </div>
      </div>
    )
  }

  // Get goals with milestones for individual timelines
  const goalsWithMilestones = goals.filter(g => g.milestones && g.milestones.length > 0)

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: colors.bgSecondary
    }}>
      <PageHeader />

      {/* Main content area - Two columns */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        padding: '16px',
        gap: '16px'
      }}>
        {/* LEFT COLUMN - Plan */}
        <div style={{
          width: '40%',
          minWidth: '300px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              background: isDarkMode ? '#3d2020' : '#fee2e2',
              color: isDarkMode ? '#fca5a5' : '#dc2626',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* Plan Content */}
          <div style={{
            flex: 1,
            background: colors.bgPrimary,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            padding: '20px',
            overflow: 'auto'
          }}>
            {!plan ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '16px'
              }}>
                <p style={{ color: colors.textSecondary, margin: 0 }}>
                  You don't have a life plan yet.
                </p>
                <button
                  onClick={handleCreatePlan}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Create My Plan
                </button>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  flexShrink: 0
                }}>
                  <h2 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '600',
                    color: colors.textPrimary
                  }}>
                    {plan.title}
                  </h2>
                  <span style={{
                    fontSize: '12px',
                    color: colors.textTertiary
                  }}>
                    {isEditing ? 'Editing...' : 'Click to edit'}
                  </span>
                </div>

                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    onBlur={handleBlur}
                    autoFocus
                    style={{
                      flex: 1,
                      width: '100%',
                      padding: '12px',
                      background: colors.bgSecondary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                ) : (
                  <div
                    onClick={() => setIsEditing(true)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: colors.bgSecondary,
                      borderRadius: '8px',
                      cursor: 'text',
                      whiteSpace: 'pre-wrap',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: editContent ? colors.textPrimary : colors.textTertiary,
                      overflow: 'auto'
                    }}
                  >
                    {editContent || 'Click to add your plan content...'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - Timelines + Chat */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflow: 'hidden'
        }}>
          {/* Goal Timelines (Top Right) */}
          <div style={{
            flex: 1,
            background: colors.bgPrimary,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            overflow: 'auto',
            padding: '16px'
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '14px',
              fontWeight: '600',
              color: colors.textPrimary
            }}>
              Goal Timelines
            </h3>

            {goalsWithMilestones.length === 0 ? (
              <div style={{
                color: colors.textSecondary,
                fontSize: '13px',
                padding: '20px',
                textAlign: 'center'
              }}>
                No goals with milestones yet. Create goals with milestones to see their timelines.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {goalsWithMilestones.map(goal => (
                  <div key={goal.id} style={{
                    background: colors.bgSecondary,
                    borderRadius: '8px',
                    padding: '12px'
                  }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: colors.textPrimary,
                      marginBottom: '8px'
                    }}>
                      {goal.title}
                    </div>
                    <div style={{ height: '60px' }}>
                      <PlanTimeline
                        goals={[goal]}
                        onMilestoneUpdate={handleMilestoneUpdate}
                        hideTitle
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat (Bottom Right - Compact) */}
          <div style={{
            height: '200px',
            flexShrink: 0,
            background: colors.bgPrimary,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            overflow: 'hidden'
          }}>
            <ChatBot hideHeader compact />
          </div>
        </div>
      </div>
    </div>
  )
}
