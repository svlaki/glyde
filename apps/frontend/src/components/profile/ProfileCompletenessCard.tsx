import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'
import type { UserProfile } from '../../lib/profileService'
import { useAuth } from '../../lib/authContext'
import { EditButton } from '../ui/IconButtons'

interface ProfileCompletenessCardProps {
  summary?: any
  profile?: UserProfile | null
  onProfileUpdated?: () => void
}

interface OverviewField {
  label: string
  value: string | undefined
}

function formatBirthday(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const date = new Date(raw + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
}

export function ProfileCompletenessCard({ profile }: ProfileCompletenessCardProps) {
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const { user } = useAuth()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)
  const navigate = useNavigate()

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const profileAny = profile as any

  const fields: OverviewField[] = [
    { label: 'Name', value: profileAny?.preferred_name || profileAny?.display_name },
    { label: 'Email', value: user?.email },
    { label: 'Occupation', value: profileAny?.occupation },
    { label: 'Field of Study', value: profileAny?.field_of_study },
    { label: 'Timezone', value: profileAny?.timezone },
    { label: 'Birthday', value: formatBirthday(profileAny?.birthday) },
  ]

  const filledFields = fields.filter(f => f.value)

  return (
    <div style={{
      background: colors.bgSecondary,
      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: isDarkMode
        ? '0 2px 8px rgba(0,0,0,0.3)'
        : '0 1px 4px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.03)',
    }}>
      <div style={{
        padding: isMobile ? '14px 16px 10px' : '16px 20px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ ...typography.headingMd, color: colors.textPrimary }}>
          About
        </div>
        <EditButton
          onClick={() => navigate('/profile/edit')}
          title="Edit profile"
          mobile={isMobile}
        />
      </div>

      <div style={{
        padding: isMobile ? '0 16px 16px' : '0 20px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {filledFields.length === 0 ? (
          <div style={{ ...typography.bodySm, color: colors.textTertiary, padding: '8px 0' }}>
            No profile info yet. Tap edit to add details.
          </div>
        ) : (
          filledFields.map(field => (
            <div key={field.label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ ...typography.labelMd, color: colors.textSecondary }}>
                {field.label}
              </span>
              <span style={{ ...typography.bodySm, color: colors.textPrimary }}>
                {field.value}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
