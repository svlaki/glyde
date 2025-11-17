import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { Calendar } from '../components/Calendar'
import { ChatBot } from '../components/ChatBot'
import { AgentInteractions } from '../components/AgentInteractions'
import { TodoList } from '../components/TodoList'

export function CalendarPage() {
  const { user, signOut } = useAuth()
  const { isDarkMode, toggleDarkMode } = useDarkMode()

  const navItems = [
    { label: 'Tasks', path: '/tasks' },
    { label: 'Goals', path: '/goals' },
    { label: 'Profile', path: '/profile' }
  ]

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: isDarkMode ? '#0a0a0a' : '#fafafa'
    }}>
      {/* Header with Navigation */}
      <header style={{
        height: '60px',
        background: isDarkMode ? '#1a1a1a' : '#fff',
        borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
        display: 'flex',
        alignItems: 'center',
        padding: '0 30px',
        flexShrink: 0,
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <a
            href="/calendar"
            style={{
              fontSize: '18px',
              fontWeight: '600',
              margin: 0,
              textDecoration: 'none',
              color: isDarkMode ? '#fff' : '#000',
              cursor: 'pointer'
            }}
          >
            Glyde
          </a>
          <nav style={{ display: 'flex', gap: '8px' }}>
            {navItems.map(item => (
              <a
                key={item.path}
                href={item.path}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: isDarkMode ? '#999' : '#666',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDarkMode ? '#2a2a2a' : '#fafafa'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '13px', color: isDarkMode ? '#999' : '#666' }}>{user?.email}</span>
          <button
            onClick={toggleDarkMode}
            style={{
              padding: '8px 12px',
              background: isDarkMode ? '#2a2a2a' : '#f5f5f5',
              color: isDarkMode ? '#fff' : '#666',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDarkMode ? '#3a3a3a' : '#e5e5e5'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDarkMode ? '#2a2a2a' : '#f5f5f5'
            }}
          >
            {isDarkMode ? 'Light' : 'Dark'}
          </button>
          <button onClick={signOut} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0
      }}>
        {/* Left Sidebar - Agent Interactions + Todo List */}
        <div style={{
          width: '300px',
          borderRight: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
          background: isDarkMode ? '#1a1a1a' : '#fff',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Agent Interactions */}
          <div style={{
            flex: 1,
            borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
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
          width: '350px',
          borderLeft: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
          background: isDarkMode ? '#1a1a1a' : '#fff',
          flexShrink: 0,
          overflow: 'hidden'
        }}>
          <ChatBot />
        </div>
      </div>
    </div>
  )
}
