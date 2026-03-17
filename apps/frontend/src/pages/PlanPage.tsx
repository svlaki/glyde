import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../lib/themeContext'
import { useAuth } from '../lib/authContext'
import { TabbedGoalsPanel } from '../components/TabbedGoalsPanel'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { fetchUserPlan, createUserPlan, updateUserPlan } from '../lib/planService'
import type { LifePlan } from '../lib/planService'
import { fetchUserGoals } from '../lib/goalService'
import type { Goal } from '../lib/goalService'
import { supabase } from '../lib/supabase'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'

export function PlanPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <PlanPageMobile />
  }

  return <PlanPageDesktop />
}

function PlanPageDesktop() {
  const { theme, isDarkMode } = useTheme()
  const { user, session } = useAuth()
  const colors = getColors(theme)
  const typography = getTypography(false)

  const [plan, setPlan] = useState<LifePlan | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const isEditingRef = useRef(false)
  const initialLoadDone = useRef(false)

  // Resizable panel state
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('plan-left-width')
    return saved ? parseInt(saved) : 450
  })
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Save to localStorage when sizes change
  useEffect(() => {
    localStorage.setItem('plan-left-width', leftWidth.toString())
  }, [leftWidth])

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const newWidth = e.clientX - containerRect.left - 16
        setLeftWidth(Math.min(Math.max(newWidth, 250), 700))
      }
    }

    const handleMouseUp = () => {
      setIsResizingLeft(false)
    }

    if (isResizingLeft) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    return undefined
  }, [isResizingLeft])

  // Load data and realtime subscriptions
  useEffect(() => {
    if (!user || !session?.access_token) return

    let isSubscribed = true
    let refreshTimer: NodeJS.Timeout | null = null

    const loadData = async (isBackground = false) => {
      if (!isSubscribed) return

      if (!isBackground) {
        setIsLoading(true)
      }
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

        if (!isEditingRef.current) {
          setPlan(planResult.plan)
          setEditContent(planResult.plan?.content || '')
        }
        setGoals(goalsResult.goals)
      } catch (err) {
        if (isSubscribed) {
          setError('Failed to load data')
          console.error(err)
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false)
          initialLoadDone.current = true
        }
      }
    }

    loadData(initialLoadDone.current)

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
          refreshTimer = setTimeout(() => loadData(true), 500)
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
          if (isEditingRef.current) return
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => loadData(true), 500)
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

  const handleContentChange = (newContent: string) => {
    setEditContent(newContent)
    isEditingRef.current = true

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !session?.access_token || !plan) return

      const result = await updateUserPlan(user, session.access_token, plan.id, {
        content: newContent
      })

      if (result.plan) {
        setPlan(result.plan)
      }
    }, 1000)
  }

  const handleBlur = async () => {
    setIsEditing(false)
    isEditingRef.current = false

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    if (!user || !session?.access_token || !plan) return
    if (editContent === plan.content) return

    const result = await updateUserPlan(user, session.access_token, plan.id, {
      content: editContent
    })

    if (result.plan) {
      setPlan(result.plan)
    }
  }

  const handleMilestoneUpdate = () => {
    setRefreshKey(k => k + 1)
  }

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        background: colors.bgPrimary
      }}>
        <VerticalSidebar />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textSecondary,
          marginLeft: `${SIDEBAR_WIDTH}px`,
        }}>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary
    }}>
      <VerticalSidebar />

      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          padding: '16px',
          gap: '16px',
          marginLeft: `${SIDEBAR_WIDTH}px`,
          userSelect: isResizingLeft ? 'none' : 'auto'
        }}
      >
        {/* LEFT COLUMN - Plan */}
        <div style={{
          width: `${leftWidth}px`,
          minWidth: '250px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flexShrink: 0,
          position: 'relative'
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
                    ...typography.headingLg,
                    margin: 0,
                    fontWeight: 600,
                    color: colors.textPrimary
                  }}>
                    {plan.title}
                  </h2>
                  <span style={{
                    ...typography.labelSm,
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

          {/* Resize handle for left column */}
          <div
            onMouseDown={() => setIsResizingLeft(true)}
            style={{
              position: 'absolute',
              top: 0,
              right: -12,
              bottom: 0,
              width: '8px',
              cursor: 'col-resize',
              zIndex: 10,
              background: isResizingLeft ? colors.border : 'transparent',
              borderRadius: '4px',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => {
              if (!isResizingLeft) {
                e.currentTarget.style.background = colors.border
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizingLeft) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          />
        </div>

        {/* RIGHT COLUMN - Tabbed Goals Panel */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          minWidth: '300px'
        }}>
          <TabbedGoalsPanel
            goals={goals}
            onMilestoneUpdate={handleMilestoneUpdate}
          />
        </div>
      </div>
    </div>
  )
}

// Expandable card for mobile - shows preview, taps to fullscreen
interface ExpandableCardProps {
  title: string
  preview: React.ReactNode
  children: React.ReactNode
  onExpand: () => void
  colors: ReturnType<typeof getColors>
}

function ExpandableCard({ title, preview, onExpand, colors }: ExpandableCardProps) {
  return (
    <button
      onClick={onExpand}
      style={{
        width: '100%',
        background: colors.bgPrimary,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '16px',
        marginBottom: '16px',
        textAlign: 'left',
        cursor: 'pointer'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: '600',
          color: colors.textPrimary,
          fontFamily: "'EB Garamond', Georgia, serif"
        }}>
          {title}
        </h2>
        <span style={{
          fontSize: '12px',
          color: colors.textTertiary
        }}>
          Tap to expand →
        </span>
      </div>
      <div style={{ pointerEvents: 'none' }}>
        {preview}
      </div>
    </button>
  )
}

type ExpandedView = 'none' | 'plan' | 'goals'

function PlanPageMobile() {
  const { theme, isDarkMode } = useTheme()
  const { user, session } = useAuth()
  const colors = getColors(theme)

  const [plan, setPlan] = useState<LifePlan | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const isEditingRef = useRef(false)
  const initialLoadDone = useRef(false)

  const [expandedView, setExpandedView] = useState<ExpandedView>('none')

  // Load data and realtime subscriptions
  useEffect(() => {
    if (!user || !session?.access_token) return

    let isSubscribed = true
    let refreshTimer: NodeJS.Timeout | null = null

    const loadData = async (isBackground = false) => {
      if (!isSubscribed) return

      if (!isBackground) {
        setIsLoading(true)
      }
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

        if (!isEditingRef.current) {
          setPlan(planResult.plan)
          setEditContent(planResult.plan?.content || '')
        }
        setGoals(goalsResult.goals)
      } catch (err) {
        if (isSubscribed) {
          setError('Failed to load data')
          console.error(err)
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false)
          initialLoadDone.current = true
        }
      }
    }

    loadData(initialLoadDone.current)

    const goalsChannel = supabase
      .channel(`plan-goals-mobile-${user.id}-${Date.now()}`)
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
          refreshTimer = setTimeout(() => loadData(true), 500)
        }
      )
      .subscribe()

    const plansChannel = supabase
      .channel(`plan-life_plans-mobile-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'life_plans',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          if (isEditingRef.current) return
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => loadData(true), 500)
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

  const handleContentChange = (newContent: string) => {
    setEditContent(newContent)
    isEditingRef.current = true

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !session?.access_token || !plan) return

      const result = await updateUserPlan(user, session.access_token, plan.id, {
        content: newContent
      })

      if (result.plan) {
        setPlan(result.plan)
      }
    }, 1000)
  }

  const handleBlur = async () => {
    setIsEditing(false)
    isEditingRef.current = false

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    if (!user || !session?.access_token || !plan) return
    if (editContent === plan.content) return

    const result = await updateUserPlan(user, session.access_token, plan.id, {
      content: editContent
    })

    if (result.plan) {
      setPlan(result.plan)
    }
  }

  const handleMilestoneUpdate = () => {
    setRefreshKey(k => k + 1)
  }

  if (isLoading) {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader title="Plan" showMenu={true} showSearch={true} />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textSecondary,
          background: colors.bgPrimary
        }}>
          Loading...
        </div>
      </div>
    )
  }

  // ============ FULLSCREEN: My Life Plan ============
  if (expandedView === 'plan') {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader
          title="My Life Plan"
          onBack={() => {
            handleBlur()
            setExpandedView('none')
          }}
        />
        <div style={{
          ...mobileStyles.scrollContainer,
          background: colors.bgPrimary,
          paddingLeft: mobileSpacing.paddingX,
          paddingRight: mobileSpacing.paddingX,
          paddingTop: mobileSpacing.paddingTop,
          paddingBottom: mobileSpacing.paddingBottomNoTabs
        }}>
          {!plan ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              gap: '16px'
            }}>
              <p style={{ color: colors.textSecondary, margin: 0, textAlign: 'center' }}>
                You don't have a life plan yet.
              </p>
              <button
                onClick={handleCreatePlan}
                style={{
                  padding: '12px 24px',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  minHeight: '44px'
                }}
              >
                Create My Plan
              </button>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '12px'
              }}>
                <span style={{
                  fontSize: '12px',
                  color: colors.textTertiary
                }}>
                  {isEditing ? 'Editing... (auto-saves)' : 'Tap to edit'}
                </span>
              </div>
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  onBlur={handleBlur}
                  autoFocus
                  style={{
                    width: '100%',
                    minHeight: 'calc(100vh - 200px)',
                    padding: '16px',
                    background: colors.bgSecondary,
                    color: colors.textPrimary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    fontSize: '16px',
                    lineHeight: '1.7',
                    resize: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              ) : (
                <div
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '16px',
                    background: colors.bgSecondary,
                    borderRadius: '12px',
                    cursor: 'text',
                    whiteSpace: 'pre-wrap',
                    fontSize: '15px',
                    lineHeight: '1.7',
                    color: editContent ? colors.textPrimary : colors.textTertiary,
                    minHeight: 'calc(100vh - 200px)'
                  }}
                >
                  {editContent || 'Tap to add your plan content...'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ============ FULLSCREEN: Goals (with Timeline/Goals tabs) ============
  if (expandedView === 'goals') {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader
          title="My Goals"
          onBack={() => setExpandedView('none')}
        />
        <div style={{
          flex: 1,
          overflow: 'hidden',
          background: colors.bgPrimary
        }}>
          <TabbedGoalsPanel
            goals={goals}
            onMilestoneUpdate={handleMilestoneUpdate}
          />
        </div>
      </div>
    )
  }

  // ============ DEFAULT: Overview with all sections ============
  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Plan" showMenu={true} showSearch={true} />

      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTop,
        paddingBottom: mobileSpacing.paddingBottomNoTabs
      }}>
        {error && (
          <div style={{
            padding: '12px 16px',
            background: isDarkMode ? '#3d2020' : '#fee2e2',
            color: isDarkMode ? '#fca5a5' : '#dc2626',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {/* My Life Plan Card */}
        <ExpandableCard
          title="My Life Plan"
          onExpand={() => setExpandedView('plan')}
          colors={colors}
          preview={
            !plan ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: colors.textSecondary,
                fontSize: '13px'
              }}>
                Tap to create your life plan
              </div>
            ) : (
              <div style={{
                padding: '12px',
                background: colors.bgSecondary,
                borderRadius: '8px',
                fontSize: '13px',
                lineHeight: '1.5',
                color: colors.textSecondary,
                maxHeight: '80px',
                overflow: 'hidden'
              }}>
                {editContent?.slice(0, 150) || 'No content yet...'}
                {editContent && editContent.length > 150 ? '...' : ''}
              </div>
            )
          }
        >
          {null}
        </ExpandableCard>

        {/* My Goals Card */}
        <ExpandableCard
          title="My Goals"
          onExpand={() => setExpandedView('goals')}
          colors={colors}
          preview={
            goals.length === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: colors.textSecondary,
                fontSize: '13px'
              }}>
                No goals yet. Tap to create your first goal.
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {goals.slice(0, 3).map(goal => (
                  <div key={goal.id} style={{
                    padding: '10px 12px',
                    background: colors.bgSecondary,
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: colors.textSecondary
                  }}>
                    {goal.title}
                  </div>
                ))}
                {goals.length > 3 && (
                  <div style={{
                    fontSize: '12px',
                    color: colors.textTertiary,
                    textAlign: 'center'
                  }}>
                    +{goals.length - 3} more
                  </div>
                )}
              </div>
            )
          }
        >
          {null}
        </ExpandableCard>
      </div>
    </div>
  )
}
