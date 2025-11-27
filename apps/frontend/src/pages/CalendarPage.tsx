import { useState, useEffect, useRef } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { PageHeader } from '../components/PageHeader'
import { Calendar } from '../components/Calendar'
import { ChatBot } from '../components/ChatBot'
import { AgentInteractions } from '../components/AgentInteractions'
import { TodoList } from '../components/TodoList'
import { getColors } from '../styles/colors'

export function CalendarPage() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  // Callback to send interaction responses to chat
  const [chatCallback, setChatCallback] = useState<((message: string) => void) | null>(null)

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
      <PageHeader />

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
            <AgentInteractions onInteractionResponse={chatCallback} />
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
          <ChatBot onSetResponseCallback={setChatCallback} />

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
