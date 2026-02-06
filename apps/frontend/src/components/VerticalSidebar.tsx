import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { usePlatform } from '../hooks/usePlatform'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { GlobalSearch } from './GlobalSearch'

const COLLAPSED_WIDTH = 52
const EXPANDED_WIDTH = 280

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

// SVG Icons
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const PlanIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const AspectsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
)

const ConnectionsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

const ProfileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const FriendsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const SignOutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const navItems: NavItem[] = [
  { path: '/calendar', label: 'Calendar', icon: <CalendarIcon /> },
  { path: '/plan', label: 'Plan', icon: <PlanIcon /> },
  { path: '/aspects', label: 'Aspects', icon: <AspectsIcon /> },
  { path: '/friends', label: 'Friends', icon: <FriendsIcon /> },

  { path: '/profile', label: 'Profile', icon: <ProfileIcon /> },
]

interface VerticalSidebarProps {
  onSelectEvent?: (eventId: string) => void
  onSelectTask?: (taskId: string) => void
  onSelectGoal?: (goalId: string) => void
}

export function VerticalSidebar({
  onSelectEvent,
  onSelectTask,
  onSelectGoal
}: VerticalSidebarProps) {
  const location = useLocation()
  const { signOut } = useAuth()
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const typography = getTypography(false)

  // Don't render on mobile
  if (isMobile) {
    return null
  }

  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar-expanded')
    return saved === 'true'
  })

  const [showSearchModal, setShowSearchModal] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-expanded', isExpanded.toString())
  }, [isExpanded])

  // Handle click outside to collapse
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded])

  // Handle Escape key to collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  const handleSignOut = useCallback(() => {
    setIsExpanded(false)
    signOut()
  }, [signOut])

  const isActive = (path: string) => location.pathname === path

  const iconButtonStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: colors.textSecondary,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  const navItemStyle = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: isExpanded ? '10px 16px' : '10px 8px',
    borderRadius: '8px',
    background: active ? colors.bgHover : 'transparent',
    border: 'none',
    color: active ? colors.textPrimary : colors.textSecondary,
    cursor: 'pointer',
    transition: 'all 0.15s',
    textDecoration: 'none',
    width: '100%',
    fontWeight: active ? 500 : 400,
    borderLeft: active ? `3px solid ${colors.textPrimary}` : '3px solid transparent',
    justifyContent: isExpanded ? 'flex-start' : 'center',
  })

  return (
    <>
      {/* Overlay backdrop when expanded */}
      {isExpanded && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            zIndex: 999,
            transition: 'opacity 0.2s',
          }}
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: isExpanded ? `${EXPANDED_WIDTH}px` : `${COLLAPSED_WIDTH}px`,
          background: colors.bgSecondary,
          borderRight: `1px solid ${colors.border}`,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
          boxShadow: isExpanded ? '4px 0 24px rgba(0, 0, 0, 0.15)' : 'none',
        }}
      >
        {/* Menu button / Logo area */}
        <div style={{
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'space-between' : 'center',
          height: '68px',
        }}>
          {isExpanded ? (
            <>
              <a
                href="/calendar"
                className="serif"
                style={{
                  fontSize: '26px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: colors.textPrimary,
                  marginLeft: '8px',
                  letterSpacing: '-0.02em',
                }}
              >
                Glyde
              </a>
              <button
                onClick={() => setIsExpanded(false)}
                style={{
                  ...iconButtonStyle,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                title="Collapse menu"
              >
                <CloseIcon />
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              style={{
                ...iconButtonStyle,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              title="Expand menu"
            >
              <MenuIcon />
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{
          padding: '8px',
          paddingTop: isExpanded ? '16px' : '32px',
        }}>
          {isExpanded ? (
            <button
              onClick={() => setShowSearchModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                height: '36px',
                padding: '0 12px',
                background: colors.bgTertiary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.textSecondary,
                fontSize: '13px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
              onMouseLeave={(e) => { e.currentTarget.style.background = colors.bgTertiary }}
            >
              <SearchIcon />
              <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
              <span style={{ fontSize: '11px', opacity: 0.6 }}>⌘K</span>
            </button>
          ) : (
            <button
              onClick={() => setShowSearchModal(true)}
              style={{
                ...iconButtonStyle,
                margin: '0 auto',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              title="Search (⌘K)"
            >
              <SearchIcon />
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav style={{
          flex: 1,
          padding: isExpanded ? '12px 8px' : '8px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflow: 'auto',
        }}>
          {navItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              style={navItemStyle(isActive(item.path))}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.background = colors.bgHover
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
              title={isExpanded ? undefined : item.label}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px' }}>
                {item.icon}
              </span>
              {isExpanded && (
                <span style={{ ...typography.bodyMd }}>{item.label}</span>
              )}
            </a>
          ))}
        </nav>

        {/* Bottom section: Dark mode toggle + Sign out */}
        <div style={{
          padding: isExpanded ? '12px 8px' : '8px 0',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: isExpanded ? '10px 16px' : '10px 8px',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              transition: 'all 0.15s',
              width: '100%',
              justifyContent: isExpanded ? 'flex-start' : 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            title={isExpanded ? undefined : (isDarkMode ? 'Light Mode' : 'Dark Mode')}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px' }}>
              {isDarkMode ? <SunIcon /> : <MoonIcon />}
            </span>
            {isExpanded && (
              <span style={{ ...typography.bodyMd }}>
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </span>
            )}
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: isExpanded ? '10px 16px' : '10px 8px',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              transition: 'all 0.15s',
              width: '100%',
              justifyContent: isExpanded ? 'flex-start' : 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            title={isExpanded ? undefined : 'Sign Out'}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px' }}>
              <SignOutIcon />
            </span>
            {isExpanded && (
              <span style={{ ...typography.bodyMd }}>Sign Out</span>
            )}
          </button>
        </div>
      </div>

      {/* Search modal when search button clicked */}
      {showSearchModal && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1001,
              backdropFilter: 'blur(2px)',
            }}
            onClick={() => setShowSearchModal(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '15%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1002,
              width: '100%',
              maxWidth: '600px',
            }}
          >
            <GlobalSearch
              inline
              onClose={() => setShowSearchModal(false)}
              onSelectEvent={(eventId) => {
                setShowSearchModal(false)
                onSelectEvent?.(eventId)
              }}
              onSelectTask={(taskId) => {
                setShowSearchModal(false)
                onSelectTask?.(taskId)
              }}
              onSelectGoal={(goalId) => {
                setShowSearchModal(false)
                onSelectGoal?.(goalId)
              }}
            />
          </div>
        </>
      )}
    </>
  )
}

// Export the collapsed width for use in page layouts
export const SIDEBAR_WIDTH = COLLAPSED_WIDTH
