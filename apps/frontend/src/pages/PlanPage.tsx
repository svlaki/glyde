import { useState, useEffect, useRef } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { useAuth } from '../lib/authContext'
import { PlanTimeline } from '../components/PlanTimeline'
import { ChatBot, ChatBotHandle, ClearIcon } from '../components/ChatBot'
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
import { mobileStyles, mobileSpacing, mobileHeaderStyles } from '../styles/mobileStyles'

export function PlanPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <PlanPageMobile />
  }

  return <PlanPageDesktop />
}

function PlanPageDesktop() {
  const { isDarkMode } = useDarkMode()
  const { user, session } = useAuth()
  const colors = getColors(isDarkMode)
  const typography = getTypography(false)

  const [plan, setPlan] = useState<LifePlan | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Resizable panel state
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('plan-left-width')
    return saved ? parseInt(saved) : 450
  })
  const [chatHeight, setChatHeight] = useState(() => {
    const saved = localStorage.getItem('plan-chat-height')
    return saved ? parseInt(saved) : 400 // Default twice as tall (was 200)
  })
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingChat, setIsResizingChat] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rightColumnRef = useRef<HTMLDivElement>(null)

  // Save to localStorage when sizes change
  useEffect(() => {
    localStorage.setItem('plan-left-width', leftWidth.toString())
  }, [leftWidth])

  useEffect(() => {
    localStorage.setItem('plan-chat-height', chatHeight.toString())
  }, [chatHeight])

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const newWidth = e.clientX - containerRect.left - 16 // account for padding
        setLeftWidth(Math.min(Math.max(newWidth, 250), 700))
      }

      if (isResizingChat && rightColumnRef.current) {
        const rightRect = rightColumnRef.current.getBoundingClientRect()
        const newHeight = rightRect.bottom - e.clientY
        setChatHeight(Math.min(Math.max(newHeight, 150), 600))
      }
    }

    const handleMouseUp = () => {
      setIsResizingLeft(false)
      setIsResizingChat(false)
    }

    if (isResizingLeft || isResizingChat) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    return undefined
  }, [isResizingLeft, isResizingChat])

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

  // Get goals with milestones for individual timelines
  const goalsWithMilestones = goals.filter(g => g.milestones && g.milestones.length > 0)

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary
    }}>
      {/* Vertical Sidebar */}
      <VerticalSidebar />

      {/* Main content area - Two columns, offset by sidebar */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          padding: '16px',
          gap: '16px',
          marginLeft: `${SIDEBAR_WIDTH}px`,
          userSelect: (isResizingLeft || isResizingChat) ? 'none' : 'auto'
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

        {/* RIGHT COLUMN - Timelines + Chat */}
        <div
          ref={rightColumnRef}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '0',
            overflow: 'hidden',
            minWidth: '300px'
          }}
        >
          {/* Goal Timelines (Top Right) */}
          <div style={{
            flex: 1,
            background: colors.bgPrimary,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            overflow: 'auto',
            padding: '16px',
            marginBottom: '8px',
            minHeight: '150px'
          }}>
            <h3 style={{
              ...typography.headingMd,
              margin: '0 0 12px 0',
              fontWeight: 600,
              color: colors.textPrimary
            }}>
              Goal Timelines
            </h3>

            {goalsWithMilestones.length === 0 ? (
              <div style={{
                ...typography.bodySm,
                color: colors.textSecondary,
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
                      ...typography.labelMd,
                      fontWeight: 500,
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

          {/* Resize handle for chat height */}
          <div
            onMouseDown={() => setIsResizingChat(true)}
            style={{
              height: '8px',
              cursor: 'row-resize',
              zIndex: 10,
              background: isResizingChat ? colors.border : 'transparent',
              borderRadius: '4px',
              transition: 'background 0.15s',
              marginBottom: '8px'
            }}
            onMouseEnter={(e) => {
              if (!isResizingChat) {
                e.currentTarget.style.background = colors.border
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizingChat) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          />

          {/* Chat (Bottom Right) */}
          <div style={{
            height: `${chatHeight}px`,
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

type ExpandedView = 'none' | 'plan' | 'timelines' | 'chat'

function PlanPageMobile() {
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

  // Which view is currently expanded to fullscreen
  const [expandedView, setExpandedView] = useState<ExpandedView>('none')

  // ChatBot ref for external header control
  const chatBotRef = useRef<ChatBotHandle>(null)
  const [chatIsLoading, setChatIsLoading] = useState(false)

  // Poll ChatBot loading state for header display
  useEffect(() => {
    if (expandedView !== 'chat') return
    const interval = setInterval(() => {
      if (chatBotRef.current) {
        setChatIsLoading(chatBotRef.current.isLoading)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [expandedView])

  // Load data and realtime subscriptions
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
          refreshTimer = setTimeout(() => loadData(), 500)
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

  // Save on blur
  const handleBlur = async () => {
    setIsEditing(false)

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

  const goalsWithMilestones = goals.filter(g => g.milestones && g.milestones.length > 0)

  if (isLoading) {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader title="Plan" showMenu={true} />
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
            handleBlur() // Save before leaving
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

  // ============ FULLSCREEN: Goal Timelines ============
  if (expandedView === 'timelines') {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader
          title="Goal Timelines"
          onBack={() => setExpandedView('none')}
        />
        <div style={{
          ...mobileStyles.scrollContainer,
          background: colors.bgPrimary,
          paddingLeft: mobileSpacing.paddingX,
          paddingRight: mobileSpacing.paddingX,
          paddingTop: mobileSpacing.paddingTop,
          paddingBottom: mobileSpacing.paddingBottomNoTabs
        }}>
          {goalsWithMilestones.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: colors.textSecondary,
              fontSize: '14px',
              textAlign: 'center'
            }}>
              No goals with milestones yet. Create goals with milestones to see their timelines.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {goalsWithMilestones.map(goal => (
                <div key={goal.id} style={{
                  background: colors.bgSecondary,
                  borderRadius: '12px',
                  padding: '16px',
                  border: `1px solid ${colors.border}`
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: colors.textPrimary,
                    marginBottom: '12px',
                    fontFamily: "'EB Garamond', Georgia, serif"
                  }}>
                    {goal.title}
                  </div>
                  <div style={{ height: '80px' }}>
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
      </div>
    )
  }

  // ============ FULLSCREEN: Chat ============
  if (expandedView === 'chat') {
    return (
      <div style={mobileStyles.fullHeight}>
        {/* Custom header with status and trash button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: mobileHeaderStyles.gap,
          padding: `0 ${mobileHeaderStyles.paddingX}`,
          paddingTop: mobileHeaderStyles.paddingTop,
          paddingBottom: mobileHeaderStyles.paddingBottom,
          background: colors.bgSecondary,
          flexShrink: 0
        }}>
          <button
            onClick={() => setExpandedView('none')}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.textPrimary,
              fontSize: mobileHeaderStyles.buttonFontSize,
              padding: mobileHeaderStyles.buttonPadding,
              cursor: 'pointer',
              minWidth: mobileHeaderStyles.buttonMinSize,
              minHeight: mobileHeaderStyles.buttonMinSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ←
          </button>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            flex: 1,
          }}>
            <h1 style={{
              fontSize: mobileHeaderStyles.titleFontSize,
              fontWeight: mobileHeaderStyles.titleFontWeight,
              letterSpacing: mobileHeaderStyles.titleLetterSpacing,
              margin: 0,
              color: colors.textPrimary,
              lineHeight: 1,
            }}>
              Chat
            </h1>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: chatIsLoading ? '#fbbf24' : '#4ade80',
                flexShrink: 0,
                alignSelf: 'center',
                transform: 'translateY(1px)',  // Visually align dot with text baseline
              }} />
              <span style={{
                fontSize: '12px',
                color: colors.textTertiary,
                fontWeight: '500',
                lineHeight: 1,
              }}>
                {chatIsLoading ? 'Typing...' : 'Online'}
              </span>
            </div>
          </div>
          <button
            onClick={() => chatBotRef.current?.clearChat()}
            title="Clear conversation"
            style={{
              padding: '4px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              color: colors.textTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: mobileHeaderStyles.buttonMinSize,
              minHeight: mobileHeaderStyles.buttonMinSize,
            }}
          >
            <ClearIcon size={14} />
          </button>
        </div>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: colors.bgPrimary,
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))'
        }}>
          <ChatBot ref={chatBotRef} mobileEmbedded hideHeader />
        </div>
      </div>
    )
  }

  // ============ DEFAULT: Overview with all sections ============
  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Plan" showMenu={true} />

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

        {/* Goal Timelines Card */}
        <ExpandableCard
          title="Goal Timelines"
          onExpand={() => setExpandedView('timelines')}
          colors={colors}
          preview={
            goalsWithMilestones.length === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: colors.textSecondary,
                fontSize: '13px'
              }}>
                No goals with milestones yet
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {goalsWithMilestones.slice(0, 2).map(goal => (
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
                {goalsWithMilestones.length > 2 && (
                  <div style={{
                    fontSize: '12px',
                    color: colors.textTertiary,
                    textAlign: 'center'
                  }}>
                    +{goalsWithMilestones.length - 2} more
                  </div>
                )}
              </div>
            )
          }
        >
          {null}
        </ExpandableCard>

        {/* Chat Card */}
        <ExpandableCard
          title="Chat"
          onExpand={() => setExpandedView('chat')}
          colors={colors}
          preview={
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: colors.textSecondary,
              fontSize: '13px'
            }}>
              Tap to chat with your AI assistant
            </div>
          }
        >
          {null}
        </ExpandableCard>
      </div>
    </div>
  )
}
