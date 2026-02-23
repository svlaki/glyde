import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'
import { useAuth } from '../lib/authContext'
import { fetchUserProfile, updateProfileField, UserProfile } from '../lib/profileService'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'

export function ProfileEditPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <ProfileEditMobile />
  }

  return <ProfileEditDesktop />
}

function useProfileEdit() {
  const { user, session } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    if (!user || !session) return
    setLoading(true)
    try {
      const result = await fetchUserProfile(user, session.access_token)
      setProfile(result.profile || null)
    } catch {
      // best-effort load
    } finally {
      setLoading(false)
    }
  }, [user, session])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleSaveField = useCallback(async (field: string, value: any) => {
    if (!user || !session) return
    const result = await updateProfileField(user, session.access_token, field, value)
    if (result.error) {
      throw new Error(result.error)
    }
    await loadProfile()
  }, [user, session, loadProfile])

  return { profile, loading, handleSaveField }
}

interface EditableFieldProps {
  label: string
  value: string | undefined
  field: string
  onSave: (field: string, value: any) => Promise<void>
  type?: 'text' | 'date'
  colors: ReturnType<typeof getColors>
  typography: ReturnType<typeof getTypography>
  isDarkMode: boolean
}

function EditableField({ label, value, field, onSave, type = 'text', colors, typography, isDarkMode }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(value || '')
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleSave = async () => {
    if (editValue === (value || '')) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(field, editValue || null)
    } catch (err) {
      // revert on error
      setEditValue(value || '')
    } finally {
      setSaving(false)
      setIsEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditValue(value || '')
      setIsEditing(false)
    }
  }

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: `1px solid ${borderColor}`,
      gap: '12px',
    }}>
      <span style={{
        ...typography.labelMd,
        color: colors.textSecondary,
        flexShrink: 0,
        minWidth: '100px',
      }}>
        {label}
      </span>
      {isEditing ? (
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={saving}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: colors.bgSecondary,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            textAlign: 'right',
            maxWidth: '220px',
          }}
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: 'transparent',
            color: value ? colors.textPrimary : colors.textTertiary,
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'inherit',
            textAlign: 'right',
            borderRadius: '6px',
            transition: 'background 0.15s',
            maxWidth: '220px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          {value || 'Tap to add'}
        </button>
      )}
    </div>
  )
}

interface HabitsFieldProps {
  habits: string[]
  onSave: (field: string, value: any) => Promise<void>
  colors: ReturnType<typeof getColors>
  typography: ReturnType<typeof getTypography>
  isDarkMode: boolean
}

function HabitsField({ habits, onSave, colors, typography, isDarkMode }: HabitsFieldProps) {
  const [newHabit, setNewHabit] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAdd = async () => {
    const trimmed = newHabit.trim()
    if (!trimmed) return
    if (habits.includes(trimmed)) {
      setNewHabit('')
      return
    }
    setSaving(true)
    try {
      await onSave('habits', [...habits, trimmed])
      setNewHabit('')
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (habit: string) => {
    setSaving(true)
    try {
      await onSave('habits', habits.filter(h => h !== habit))
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div style={{
      padding: '12px 0',
      borderBottom: `1px solid ${borderColor}`,
    }}>
      <div style={{
        ...typography.labelMd,
        color: colors.textSecondary,
        marginBottom: '8px',
      }}>
        Habits / Personality
      </div>

      {habits.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '12px',
        }}>
          {habits.map(habit => (
            <div
              key={habit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '20px',
                backgroundColor: isDarkMode ? '#1e3a5f' : '#eff6ff',
                border: `1px solid ${isDarkMode ? '#2563eb' : '#bfdbfe'}`,
                fontSize: '14px',
                color: colors.textPrimary,
              }}
            >
              <span style={{ flex: 1 }}>{habit}</span>
              <button
                onClick={() => handleRemove(habit)}
                disabled={saving}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textTertiary,
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '16px',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={newHabit}
          onChange={(e) => setNewHabit(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a habit or trait..."
          disabled={saving}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: colors.bgSecondary,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '20px',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newHabit.trim()}
          style={{
            padding: '8px 16px',
            background: isDarkMode ? '#1e3a5f' : '#eff6ff',
            border: `1px solid ${isDarkMode ? '#2563eb' : '#bfdbfe'}`,
            borderRadius: '20px',
            color: isDarkMode ? '#93c5fd' : '#2563eb',
            cursor: newHabit.trim() ? 'pointer' : 'default',
            fontSize: '14px',
            fontWeight: 500,
            opacity: newHabit.trim() ? 1 : 0.5,
          }}
        >
          + Add
        </button>
      </div>
    </div>
  )
}

function ProfileEditForm({ profile, onSave, colors, typography, isDarkMode }: {
  profile: UserProfile
  onSave: (field: string, value: any) => Promise<void>
  colors: ReturnType<typeof getColors>
  typography: ReturnType<typeof getTypography>
  isDarkMode: boolean
}) {
  const profileAny = profile as any

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <EditableField
        label="Full Name"
        value={profileAny.display_name}
        field="display_name"
        onSave={onSave}
        colors={colors}
        typography={typography}
        isDarkMode={isDarkMode}
      />
      <EditableField
        label="Preferred Name"
        value={profileAny.preferred_name}
        field="preferred_name"
        onSave={onSave}
        colors={colors}
        typography={typography}
        isDarkMode={isDarkMode}
      />
      <EditableField
        label="Birthday"
        value={profileAny.birthday}
        field="birthday"
        onSave={onSave}
        type="date"
        colors={colors}
        typography={typography}
        isDarkMode={isDarkMode}
      />
      <EditableField
        label="Gender"
        value={profileAny.gender}
        field="gender"
        onSave={onSave}
        colors={colors}
        typography={typography}
        isDarkMode={isDarkMode}
      />
      <EditableField
        label="Occupation"
        value={profileAny.occupation}
        field="occupation"
        onSave={onSave}
        colors={colors}
        typography={typography}
        isDarkMode={isDarkMode}
      />
      <EditableField
        label="Field of Study"
        value={profileAny.field_of_study}
        field="field_of_study"
        onSave={onSave}
        colors={colors}
        typography={typography}
        isDarkMode={isDarkMode}
      />
      <EditableField
        label="Timezone"
        value={profileAny.timezone}
        field="timezone"
        onSave={onSave}
        colors={colors}
        typography={typography}
        isDarkMode={isDarkMode}
      />
      <HabitsField
        habits={Array.isArray(profileAny.habits) ? profileAny.habits : []}
        onSave={onSave}
        colors={colors}
        typography={typography}
        isDarkMode={isDarkMode}
      />
    </div>
  )
}

function ProfileEditMobile() {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(true)
  const navigate = useNavigate()
  const { profile, loading, handleSaveField } = useProfileEdit()

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Edit Profile" showMenu={true} />

      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTop,
        paddingBottom: mobileSpacing.paddingBottomNoTabs,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {/* Back link */}
          <button
            onClick={() => navigate('/profile')}
            style={{
              ...typography.bodySm,
              color: colors.textSecondary,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 0',
              textAlign: 'left',
            }}
          >
            ← Back to Profile
          </button>

          {loading ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: colors.textSecondary,
              ...typography.bodyMd,
            }}>
              Loading profile...
            </div>
          ) : profile ? (
            <div style={{
              background: colors.bgPrimary,
              border: `1px solid ${borderColor}`,
              borderRadius: '6px',
              padding: '4px 16px',
            }}>
              <ProfileEditForm
                profile={profile}
                onSave={handleSaveField}
                colors={colors}
                typography={typography}
                isDarkMode={isDarkMode}
              />
            </div>
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: colors.textSecondary,
              ...typography.bodyMd,
            }}>
              No profile found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileEditDesktop() {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)
  const navigate = useNavigate()
  const { profile, loading, handleSaveField } = useProfileEdit()

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary,
    }}>
      <VerticalSidebar />

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px',
        marginLeft: `${SIDEBAR_WIDTH}px`,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <button
              onClick={() => navigate('/profile')}
              style={{
                ...typography.bodySm,
                color: colors.textSecondary,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              ← Back
            </button>
            <div style={{ ...typography.headingLg, color: colors.textPrimary }}>
              Edit Profile
            </div>
          </div>

          {loading ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: colors.textSecondary,
              ...typography.bodyMd,
            }}>
              Loading profile...
            </div>
          ) : profile ? (
            <div style={{
              background: colors.bgPrimary,
              border: `1px solid ${borderColor}`,
              borderRadius: '6px',
              padding: '4px 20px',
            }}>
              <ProfileEditForm
                profile={profile}
                onSave={handleSaveField}
                colors={colors}
                typography={typography}
                isDarkMode={isDarkMode}
              />
            </div>
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: colors.textSecondary,
              ...typography.bodyMd,
            }}>
              No profile found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
