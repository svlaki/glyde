import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../lib/themeContext'
import { Calendar } from '../components/Calendar'
import { ChatBot, ChatBotHandle, ClearIcon } from '../components/ChatBot'
import { Inbox } from '../components/Inbox'
import { TodoList } from '../components/TodoList'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors } from '../styles/colors'
import { usePlatform } from '../hooks/usePlatform'
import { useKeyboard } from '../hooks/useKeyboard'
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
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const { isKeyboardOpen } = useKeyboard()
  const [activeTab, setActiveTab] = useState<'calendar' | 'chat' | 'todos' | 'agents'>('calendar')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const chatBotRef = useRef<ChatBotHandle>(null)
  const [chatIsLoading, setChatIsLoading] = useState(false)
  const pendingChatMessage = useRef<string | null>(null)

  const handleMobileChatReply = useCallback((message: string) => {
    pendingChatMessage.current = message
    setActiveTab('chat')
  }, [])

  // Send pending chat message after switching to chat tab
  useEffect(() => {
    if (activeTab === 'chat' && pendingChatMessage.current) {
      const message = pendingChatMessage.current
      pendingChatMessage.current = null
      // Delay to let ChatBot mount/render
      const timer = setTimeout(() => {
        chatBotRef.current?.sendMessage(message)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [activeTab])

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
    { id: 'agents' as const, label: 'Inbox' }
  ]

  // Get header title based on active tab
  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'chat': return 'Chat'
      case 'todos': return 'Tasks'
      case 'agents': return 'Inbox'
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
        background: colors.bgSecondary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTopSafe
      }}>
        {activeTab === 'calendar' && <CalendarMobileWrapper />}
        {activeTab === 'chat' && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden'
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
              <Inbox hideHeader onChatReply={handleMobileChatReply} />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Bottom tabs navigation — hidden when keyboard is open */}
      {!isKeyboardOpen && (
        <div style={{
          flexShrink: 0,
          minHeight: '60px',
          background: colors.bgSecondary,
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          paddingTop: '4px',
          paddingBottom: 'max(env(safe-area-inset-bottom), 4px)'
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
      )}
    </div>
  )
}

function CalendarPageDesktop() {
  const { theme } = useTheme()
  const colors = getColors(theme)
  const chatBotRef = useRef<ChatBotHandle>(null)

  const handleChatReply = useCallback((message: string) => {
    setTimeout(() => {
      chatBotRef.current?.sendMessage(message)
    }, 250)
  }, [])

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgSecondary,
    }}>
      <VerticalSidebar
        onSelectEvent={() => {}}
        onSelectTask={() => {}}
        onSelectGoal={() => {}}
      />

      <div style={{
        flex: 1,
        marginLeft: `${SIDEBAR_WIDTH}px`,
        overflow: 'hidden',
        height: '100vh',
      }}>
        <>
          <div key="inbox" style={{ overflow: 'hidden' }}>
            <Inbox onChatReply={handleChatReply} />
          </div>
          <div key="todolist" style={{ overflow: 'hidden' }}>
            <TodoList />
          </div>
          <div key="calendar" style={{ overflow: 'hidden', display: 'flex' }}>
            <Calendar />
          </div>
          <div key="chatbot" style={{ overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <ChatBot ref={chatBotRef} />
            </div>
          </div>
        </>
      </div>
    </div>
  )
}
