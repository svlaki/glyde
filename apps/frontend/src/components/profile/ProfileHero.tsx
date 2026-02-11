import { useMemo, useRef } from 'react'
import { useAuth } from '../../lib/authContext'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { fontFamily } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'
import { useAvatarUpload } from '../../hooks/useAvatarUpload'

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
  const { user, preferredName, avatarUrl, updateAvatarUrl, signOut } = useAuth()
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploading, error: uploadError, handleFileSelect } = useAvatarUpload()

  const greeting = useMemo(() => getGreeting(), [])
  const initials = useMemo(() => getInitials(preferredName, user?.email), [preferredName, user?.email])
  const memberSince = useMemo(() => formatMemberSince(user?.created_at), [user?.created_at])
  const displayName = preferredName || user?.email?.split('@')[0] || 'there'

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const avatarSize = isMobile ? '52px' : '64px'

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const newUrl = await handleFileSelect(file, user.id)
    if (newUrl) {
      updateAvatarUrl(newUrl)
    }

    // Reset input so re-selecting the same file triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div
              onClick={handleAvatarClick}
              onMouseEnter={(e) => {
                const overlay = e.currentTarget.querySelector('[data-edit-overlay]') as HTMLElement
                if (overlay) overlay.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                const overlay = e.currentTarget.querySelector('[data-edit-overlay]') as HTMLElement
                if (overlay) overlay.style.opacity = '0'
              }}
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: '50%',
                background: colors.bgTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                position: 'relative',
                opacity: uploading ? 0.6 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{
                  fontFamily: fontFamily.serif,
                  fontSize: isMobile ? '20px' : '24px',
                  fontWeight: 600,
                  color: colors.textPrimary,
                }}>
                  {initials}
                </span>
              )}
              <div
                data-edit-overlay
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.2s ease',
                  color: '#fff',
                  fontSize: isMobile ? '10px' : '12px',
                  fontFamily: fontFamily.sans,
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                }}
              >
                Edit
              </div>
            </div>
            <span style={{
              ...typography.bodySm,
              color: colors.textSecondary,
              marginTop: '4px',
              fontSize: isMobile ? '10px' : '11px',
            }}>
              Profile picture
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

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
            {uploadError && (
              <div style={{ ...typography.bodySm, color: '#d32f2f', marginTop: '4px' }}>
                {uploadError}
              </div>
            )}
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
