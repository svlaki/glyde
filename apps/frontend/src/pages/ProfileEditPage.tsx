import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'
import { useAuth } from '../lib/authContext'
import { fetchUserProfile, updateProfileField, UserProfile, ProfileSummary } from '../lib/profileService'
import { PROFILE_SECTIONS } from '../lib/profileSections'
import { ProfileSectionEditor } from '../components/profile/ProfileSectionEditor'
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
  const [summary, setSummary] = useState<ProfileSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    if (!user || !session) return
    setLoading(true)
    try {
      const result = await fetchUserProfile(user, session.access_token)
      setProfile(result.profile || null)
      setSummary(result.summary || null)
    } catch {
      // best-effort load
    } finally {
      setLoading(false)
    }
  }, [user, session])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleSave = useCallback(async (sectionKey: string, fieldKey: string, value: any) => {
    if (!user || !session) return
    const field = `${sectionKey}.${fieldKey}`
    const result = await updateProfileField(user, session.access_token, field, value)
    if (result.error) {
      throw new Error(result.error)
    }
    await loadProfile()
  }, [user, session, loadProfile])

  function getSectionData(key: string): Record<string, any> {
    if (!profile) return {}
    const val = profile[key as keyof UserProfile]
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) return { ...val }
    if (typeof val === 'string') return { value: val }
    return {}
  }

  function getSectionCompleteness(key: string): number {
    if (!summary?.sections?.[key]) return 0
    return Math.round(summary.sections[key].completeness)
  }

  return { profile, summary, loading, handleSave, getSectionData, getSectionCompleteness }
}

function ProfileEditMobile() {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(true)
  const navigate = useNavigate()
  const { profile, loading, handleSave, getSectionData, getSectionCompleteness } = useProfileEdit()

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const [expandedSection, setExpandedSection] = useState<string | null>(PROFILE_SECTIONS[0].key)

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
          ) : (
            PROFILE_SECTIONS.filter(s => s.isJsonb).map(section => {
              const isExpanded = expandedSection === section.key
              const pct = getSectionCompleteness(section.key)

              return (
                <div key={section.key} style={{
                  background: colors.bgPrimary,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '6px',
                  overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setExpandedSection(isExpanded ? null : section.key)}
                    style={{
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{
                        ...typography.headingMd,
                        color: isExpanded ? colors.accent : colors.textPrimary,
                      }}>
                        {section.label}
                      </div>
                      <div style={{ ...typography.bodySm, color: colors.textTertiary, marginTop: '2px' }}>
                        {section.description}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ ...typography.labelMd, color: colors.textTertiary }}>
                        {pct}%
                      </span>
                      <span style={{
                        ...typography.labelSm,
                        textTransform: 'none' as const,
                        color: colors.textTertiary,
                        display: 'inline-block',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}>
                        ▼
                      </span>
                    </div>
                  </div>

                  {isExpanded && profile && (
                    <div style={{ padding: '0 16px 14px' }}>
                      <ProfileSectionEditor
                        sectionKey={section.key}
                        sectionData={getSectionData(section.key)}
                        onSave={handleSave}
                        onCancel={() => setExpandedSection(null)}
                      />
                    </div>
                  )}
                </div>
              )
            })
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
  const { profile, loading, handleSave, getSectionData, getSectionCompleteness } = useProfileEdit()

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const [expandedSection, setExpandedSection] = useState<string | null>(PROFILE_SECTIONS[0].key)

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
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              {PROFILE_SECTIONS.filter(s => s.isJsonb).map(section => {
                const isExpanded = expandedSection === section.key
                const pct = getSectionCompleteness(section.key)

                return (
                  <div key={section.key} style={{
                    background: colors.bgPrimary,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '6px',
                    overflow: 'hidden',
                  }}>
                    <div
                      onClick={() => setExpandedSection(isExpanded ? null : section.key)}
                      style={{
                        padding: '16px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{
                          ...typography.headingMd,
                          color: isExpanded ? colors.accent : colors.textPrimary,
                        }}>
                          {section.label}
                        </div>
                        <div style={{ ...typography.bodySm, color: colors.textTertiary, marginTop: '2px' }}>
                          {section.description}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <span style={{ ...typography.labelMd, color: colors.textTertiary }}>
                          {pct}%
                        </span>
                        <span style={{
                          ...typography.labelSm,
                          textTransform: 'none' as const,
                          color: colors.textTertiary,
                          display: 'inline-block',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                        }}>
                          ▼
                        </span>
                      </div>
                    </div>

                    {isExpanded && profile && (
                      <div style={{ padding: '0 20px 16px' }}>
                        <ProfileSectionEditor
                          sectionKey={section.key}
                          sectionData={getSectionData(section.key)}
                          onSave={handleSave}
                          onCancel={() => setExpandedSection(null)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
