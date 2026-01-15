import { useState, useEffect, useRef } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { PageHeader } from '../components/PageHeader'
import { Calendar } from '../components/Calendar'
import { ChatBot } from '../components/ChatBot'
import { AgentInteractions } from '../components/AgentInteractions'
import { TodoList } from '../components/TodoList'
import { GlobalSearch } from '../components/GlobalSearch'
import { getColors } from '../styles/colors'
import { usePlatform } from '../hooks/usePlatform'
import { mobileStyles } from '../styles/mobileStyles'
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

  // Reusable header for non-calendar tabs
  const renderHeader = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '16px',
      flexShrink: 0
    }}>
      <button
        onClick={() => setIsMenuOpen(true)}
        style={{
          background: 'transparent',
          border: 'none',
          color: colors.textPrimary,
          fontSize: '22px',
          padding: '4px',
          cursor: 'pointer',
          minWidth: '32px',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ☰
      </button>
      <h2 style={{
        fontSize: '22px',
        fontWeight: '700',
        color: colors.textPrimary,
        margin: 0,
        letterSpacing: '-0.02em',
        flex: 1
      }}>
        {getHeaderTitle()}
      </h2>
    </div>
  )

  return (
    <div style={mobileStyles.fullHeight}>
      {/* Content area - changes based on active tab */}
      <div style={{
        ...mobileStyles.scrollContainer,
        // Calendar tab: disable outer scroll, let inner calendar scroll
        // Other tabs: enable outer scroll
        overflow: activeTab === 'calendar' ? 'hidden' : 'auto',
        // Calendar tab needs flex container for proper height chain
        display: 'flex',
        flexDirection: 'column',
        background: colors.bgPrimary,
        paddingLeft: 'clamp(12px, 2.5vw, 16px)',
        paddingRight: 'clamp(12px, 2.5vw, 16px)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(70px + env(safe-area-inset-bottom, 0px))'
      }}>
        {activeTab === 'calendar' && <CalendarMobileWrapper />}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {renderHeader()}
            <div style={{ flex: 1, minHeight: 0, marginLeft: 'calc(-1 * clamp(12px, 2.5vw, 16px))', marginRight: 'calc(-1 * clamp(12px, 2.5vw, 16px))' }}>
              <ChatBot />
            </div>
          </div>
        )}
        {activeTab === 'todos' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {renderHeader()}
            <div style={{ flex: 1, minHeight: 0, marginLeft: 'calc(-1 * clamp(12px, 2.5vw, 16px))', marginRight: 'calc(-1 * clamp(12px, 2.5vw, 16px))' }}>
              <TodoList hideHeader />
            </div>
          </div>
        )}
        {activeTab === 'agents' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {renderHeader()}
            <div style={{ flex: 1, minHeight: 0, marginLeft: 'calc(-1 * clamp(12px, 2.5vw, 16px))', marginRight: 'calc(-1 * clamp(12px, 2.5vw, 16px))' }}>
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
