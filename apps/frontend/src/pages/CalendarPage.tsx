import { useState, useEffect, useRef } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { PageHeader } from '../components/PageHeader'
import { Calendar } from '../components/Calendar'
import { ChatBot, ChatBotHandle, ClearIcon } from '../components/ChatBot'
import { AgentInteractions } from '../components/AgentInteractions'
import { TodoList } from '../components/TodoList'
import { GlobalSearch } from '../components/GlobalSearch'
import { getColors } from '../styles/colors'
import { usePlatform } from '../hooks/usePlatform'
import { mobileStyles, mobileSpacing, mobileHeaderStyles } from '../styles/mobileStyles'
import { CalendarMobileWrapper } from '../components/mobile/CalendarMobileWrapper'
import { MobileMenu } from '../components/mobile/MobileMenu'

export function CalendarPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <CalendarPageMobile />
  }

  return <CalendarPageDesktop />
}

function CalendarPageMobile() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const [activeTab, setActiveTab] = useState<'calendar' | 'chat' | 'todos' | 'agents'>('calendar')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const chatBotRef = useRef<ChatBotHandle>(null)
  const [chatIsLoading, setChatIsLoading] = useState(false)

  // Poll ChatBot loading state for header display
  useEffect(() => {
    if (activeTab !== 'chat') return
    const interval = setInterval(() => {
      if (chatBotRef.current) {
        setChatIsLoading(chatBotRef.current.isLoading)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [activeTab])

  const tabs = [
    { id: 'calendar' as const, label: 'Calendar' },
    { id: 'chat' as const, label: 'Chat' },
    { id: 'todos' as const, label: 'Tasks' },
    { id: 'agents' as const, label: 'Interactions' }
  ]

  // Get header title based on active tab
  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'chat': return 'Chat'
      case 'todos': return 'Tasks'
      case 'agents': return 'Interactions'
      default: return ''
    }
  }

  // Reusable header for non-calendar tabs - uses global mobileHeaderStyles
  const renderHeader = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: mobileHeaderStyles.gap,
      marginBottom: mobileHeaderStyles.marginBottom,
      flexShrink: 0
    }}>
      <button
        onClick={() => setIsMenuOpen(true)}
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
        ☰
      </button>
      <h2 style={{
        fontSize: mobileHeaderStyles.titleFontSize,
        fontWeight: mobileHeaderStyles.titleFontWeight,
        color: colors.textPrimary,
        margin: 0,
        letterSpacing: mobileHeaderStyles.titleLetterSpacing,
        flex: activeTab === 'chat' ? 0 : 1
      }}>
        {getHeaderTitle()}
      </h2>
      {/* Chat tab: show status indicator and trash button */}
      {activeTab === 'chat' && (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            flex: 1,
            marginLeft: '8px',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: chatIsLoading ? '#fbbf24' : '#4ade80',
              flexShrink: 0,
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
        </>
      )}
    </div>
  )

  return (
    <div style={mobileStyles.fullHeight}>
      {/* Content area - changes based on active tab */}
      <div style={{
        ...mobileStyles.scrollContainer,
        // All tabs: disable outer scroll, let inner components handle scroll
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTopSafe,
        paddingBottom: mobileSpacing.paddingBottomWithTabs
      }}>
        {activeTab === 'calendar' && <CalendarMobileWrapper />}
        {activeTab === 'chat' && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            // Extend chat to the edge of the tab bar
            marginBottom: `calc(-1 * ${mobileSpacing.paddingBottomWithTabs})`,
            paddingBottom: mobileSpacing.paddingBottomWithTabs
          }}>
            {renderHeader()}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginLeft: mobileSpacing.negativeMarginX, marginRight: mobileSpacing.negativeMarginX }}>
              <ChatBot ref={chatBotRef} mobileEmbedded hideHeader />
            </div>
          </div>
        )}
        {activeTab === 'todos' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {renderHeader()}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch', marginLeft: mobileSpacing.negativeMarginX, marginRight: mobileSpacing.negativeMarginX }}>
              <TodoList hideHeader />
            </div>
          </div>
        )}
        {activeTab === 'agents' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {renderHeader()}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch', marginLeft: mobileSpacing.negativeMarginX, marginRight: mobileSpacing.negativeMarginX }}>
              <AgentInteractions hideHeader />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Bottom tabs navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: '60px',
        background: colors.bgSecondary,
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingTop: '4px',
        paddingBottom: 'max(env(safe-area-inset-bottom), 4px)',
        zIndex: 1000
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 8px',
              background: 'transparent',
              border: 'none',
              color: activeTab === tab.id ? colors.textPrimary : colors.textSecondary,
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              cursor: 'pointer',
              minHeight: '44px',
              transition: 'color 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CalendarPageDesktop() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  // Load saved widths from localStorage or use defaults
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('calendar-left-width')
    return saved ? parseInt(saved) : 300
  })

  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem('calendar-right-width')
    return saved ? parseInt(saved) : 350
  })

  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Save to localStorage when widths change
  useEffect(() => {
    localStorage.setItem('calendar-left-width', leftWidth.toString())
  }, [leftWidth])

  useEffect(() => {
    localStorage.setItem('calendar-right-width', rightWidth.toString())
  }, [rightWidth])

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()

      if (isResizingLeft) {
        const newWidth = e.clientX - containerRect.left
        // Min 200px, max 600px
        setLeftWidth(Math.min(Math.max(newWidth, 200), 600))
      }

      if (isResizingRight) {
        const newWidth = containerRect.right - e.clientX
        // Min 250px, max 600px
        setRightWidth(Math.min(Math.max(newWidth, 250), 600))
      }
    }

    const handleMouseUp = () => {
      setIsResizingLeft(false)
      setIsResizingRight(false)
    }

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    return undefined
  }, [isResizingLeft, isResizingRight])

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: colors.bgSecondary
    }}>
      {/* Header */}
      <PageHeader
        searchComponent={
          <GlobalSearch
            onSelectEvent={(eventId) => {
              // TODO: Navigate to event or open event modal
              console.log('Selected event:', eventId)
            }}
            onSelectTask={(taskId) => {
              // TODO: Navigate to task or open task modal
              console.log('Selected task:', taskId)
            }}
            onSelectGoal={(goalId) => {
              // TODO: Navigate to goal or open goal modal
              console.log('Selected goal:', goalId)
            }}
          />
        }
      />

      {/* Main Layout */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0,
          userSelect: (isResizingLeft || isResizingRight) ? 'none' : 'auto'
        }}
      >
        {/* Left Sidebar - Agent Interactions + Todo List */}
        <div style={{
          width: `${leftWidth}px`,
          borderRight: `1px solid ${colors.border}`,
          background: colors.bgSecondary,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* Agent Interactions */}
          <div style={{
            flex: 1,
            borderBottom: `1px solid ${colors.border}`,
            overflow: 'hidden',
            minHeight: 0
          }}>
            <AgentInteractions />
          </div>

          {/* Todo List */}
          <div style={{
            flex: 1,
            overflow: 'hidden',
            minHeight: 0
          }}>
            <TodoList />
          </div>

          {/* Resize handle for left sidebar */}
          <div
            onMouseDown={() => setIsResizingLeft(true)}
            style={{
              position: 'absolute',
              top: 0,
              right: -4,
              bottom: 0,
              width: '8px',
              cursor: 'col-resize',
              zIndex: 10,
              background: isResizingLeft ? colors.border : 'transparent',
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

        {/* Center - Calendar */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflow: 'auto',
          minWidth: 0
        }}>
          <Calendar />
        </div>

        {/* Right Sidebar - ChatBot */}
        <div style={{
          width: `${rightWidth}px`,
          borderLeft: `1px solid ${colors.border}`,
          background: colors.bgSecondary,
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative'
        }}>
          <ChatBot />

          {/* Resize handle for right sidebar */}
          <div
            onMouseDown={() => setIsResizingRight(true)}
            style={{
              position: 'absolute',
              top: 0,
              left: -4,
              bottom: 0,
              width: '8px',
              cursor: 'col-resize',
              zIndex: 10,
              background: isResizingRight ? colors.border : 'transparent',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => {
              if (!isResizingRight) {
                e.currentTarget.style.background = colors.border
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizingRight) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}
