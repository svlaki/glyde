import { useMemo } from 'react'
import { useAuth } from '../../lib/authContext'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { fontFamily } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Good night'
}

function getInitials(name: string | null, email: string | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name[0].toUpperCase()
  }
  if (email) {
    return email[0].toUpperCase()
  }
  return '?'
}

function formatMemberSince(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function ProfileHero() {
  const { user, preferredName, signOut } = useAuth()
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)

  const greeting = useMemo(() => getGreeting(), [])
  const initials = useMemo(() => getInitials(preferredName, user?.email), [preferredName, user?.email])
  const memberSince = useMemo(() => formatMemberSince(user?.created_at), [user?.created_at])
  const displayName = preferredName || user?.email?.split('@')[0] || 'there'

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div style={{
      paddingBottom: isMobile ? '16px' : '20px',
      borderBottom: `1px solid ${borderColor}`,
      marginBottom: isMobile ? '16px' : '20px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? '14px' : '20px',
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        {/* Avatar + Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
          <div style={{
            width: isMobile ? '52px' : '64px',
            height: isMobile ? '52px' : '64px',
            borderRadius: '50%',
            background: colors.bgTertiary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: fontFamily.serif,
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: 600,
              color: colors.textPrimary,
            }}>
              {initials}
            </span>
          </div>

          <div>
            <div style={{ ...typography.displaySm, color: colors.textPrimary }}>
              {greeting}, {displayName}
            </div>
            <div style={{
              ...typography.bodySm,
              color: colors.textSecondary,
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}>
              {user?.email && <span>{user.email}</span>}
              {memberSince && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>Member since {memberSince}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginLeft: isMobile ? '0' : 'auto',
        }}>

          <button
            onClick={signOut}
            style={{
              background: 'transparent',
              border: `1px solid ${borderColor}`,
              borderRadius: '6px',
              padding: '8px 14px',
              cursor: 'pointer',
              color: colors.textSecondary,
              ...typography.bodySm,
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
