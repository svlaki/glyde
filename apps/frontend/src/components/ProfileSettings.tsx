import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { fetchUserProfile, UserProfile } from '../lib/profileService'
import { EmptyState } from './EmptyState'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight, lineHeight } from '../styles/typography'

interface ProfileSection {
  key: keyof UserProfile
  label: string
  icon: string
  description: string
}

const PROFILE_SECTIONS: ProfileSection[] = [
  // { key: 'life', label: 'Life', icon: '◎', description: 'Personal values, priorities, and life philosophy' },
  // { key: 'work', label: 'Work', icon: '◈', description: 'Career goals, work style, and professional preferences' },
  // { key: 'productivity', label: 'Productivity', icon: '✓', description: 'Task management and productivity preferences' },
  // { key: 'health', label: 'Health', icon: '♥', description: 'Health goals, fitness routines, and wellness practices' },
  // { key: 'relationships', label: 'Relationships', icon: '◉', description: 'Important relationships and social preferences' },
  // { key: 'routines', label: 'Routines', icon: '◷', description: 'Daily routines, habits, and schedules' },
  // { key: 'decision_making', label: 'Decision Making', icon: '◆', description: 'How you make decisions and evaluate options' },
  // { key: 'communication', label: 'Communication', icon: '◐', description: 'Communication style and preferences' },
  // { key: 'learning', label: 'Learning', icon: '◓', description: 'Learning goals, interests, and study preferences' },
  // { key: 'agent_preferences', label: 'Agent Preferences', icon: '◔', description: 'AI assistant behavior and interaction preferences' },
  // { key: 'rules', label: 'Rules', icon: '◑', description: 'Personal rules and principles to follow' }
]

export function ProfileSettings() {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>(null) // All collapsed by default

  useEffect(() => {
    async function loadProfile() {
      if (!user || !session) return

      setLoading(true)
      try {
        const { profile: userProfile } = await fetchUserProfile(user, session.access_token)
        if (userProfile) {
          setProfile(userProfile)
        }
      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user, session])

  const toggleSection = (sectionKey: string) => {
    setExpandedSection(expandedSection === sectionKey ? null : sectionKey)
  }

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: colors.textSecondary,
        fontSize: fontSize.base
      }}>
        Loading profile...
      </div>
    )
  }

  if (!profile) {
    return (
      <EmptyState
        title="No profile data"
        description="Start by adding information to your profile sections"
      />
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {PROFILE_SECTIONS.map(section => {
        const sectionData = profile[section.key]
        const hasData = sectionData && Object.keys(sectionData).length > 0
        const isExpanded = expandedSection === section.key

        return (
          <div
            key={section.key}
            style={{
              background: colors.bgPrimary,
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: '6px',
              overflow: 'hidden'
            }}
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.key)}
              style={{
                width: '100%',
                padding: '20px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{
                  fontSize: '20px',
                  opacity: 0.5
                }}>{section.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.normal,
                    color: colors.textPrimary
                  }}>
                    {section.label}
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: '16px',
                color: colors.textSecondary,
                transition: 'transform 0.2s ease',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                display: 'inline-block',
                opacity: 0.5
              }}>
                ▼
              </span>
            </button>

            {/* Section Content */}
            {isExpanded && (
              <div style={{
                padding: '0 20px 20px 20px',
                borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
              }}>
                {hasData ? (
                  <div style={{
                    marginTop: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {Object.entries(sectionData).map(([key, value]) => (
                      <div key={key} style={{
                        padding: '12px 0',
                        borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`
                      }}>
                        <div style={{
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.normal,
                          color: colors.textSecondary,
                          marginBottom: '4px'
                        }}>
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div style={{
                          fontSize: fontSize.base,
                          color: colors.textPrimary,
                          whiteSpace: 'pre-wrap',
                          lineHeight: lineHeight.normal
                        }}>
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: colors.textSecondary,
                    fontSize: fontSize.base,
                    opacity: 0.5
                  }}>
                    No data
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
