import { useNavigate } from 'react-router-dom'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'
import { ProfileSummary } from '../../lib/profileService'
import { PROFILE_SECTIONS } from '../../lib/profileSections'
import { EditButton } from '../ui/IconButtons'

interface ProfileCompletenessCardProps {
  summary: ProfileSummary | null
}

const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  PROFILE_SECTIONS.map(s => [s.key, s.label])
)

function CircleArc({ percentage, size }: { percentage: number; size: number }) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  const trackColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colors.success}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  )
}

export function ProfileCompletenessCard({ summary }: ProfileCompletenessCardProps) {
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)
  const navigate = useNavigate()

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const barBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const percentage = summary?.completenessPercentage ?? 0
  const sections = summary?.sections ?? {}
  const circleSize = isMobile ? 80 : 96

  return (
    <div style={{
      background: colors.bgPrimary,
      border: `1px solid ${borderColor}`,
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: isMobile ? '14px 16px 10px' : '16px 20px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ ...typography.headingMd, color: colors.textPrimary }}>
          Profile Completeness
        </div>
        <EditButton
          onClick={() => navigate('/profile/edit')}
          title="Edit profile"
          mobile={isMobile}
        />
      </div>

      <div style={{
        padding: isMobile ? '8px 16px 16px' : '8px 20px 20px',
        display: 'flex',
        gap: isMobile ? '16px' : '24px',
        alignItems: 'flex-start',
      }}>
        {/* Circle indicator */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <CircleArc percentage={percentage} size={circleSize} />
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{
              ...typography.displaySm,
              color: colors.textPrimary,
            }}>
              {percentage}%
            </span>
          </div>
        </div>

        {/* Section bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(sections).map(([key, data]) => {
            const label = SECTION_LABELS[key] || key
            const sectionPct = Math.round(data.completeness)

            return (
              <div key={key}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '3px',
                }}>
                  <span style={{ ...typography.labelMd, color: colors.textSecondary }}>
                    {label}
                  </span>
                  <span style={{ ...typography.labelMd, color: colors.textTertiary }}>
                    {sectionPct}%
                  </span>
                </div>
                <div style={{
                  height: '3px',
                  borderRadius: '1.5px',
                  background: barBg,
                }}>
                  <div style={{
                    height: '100%',
                    borderRadius: '1.5px',
                    background: colors.accent,
                    width: `${sectionPct}%`,
                    opacity: 0.6,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            )
          })}

          {Object.keys(sections).length === 0 && (
            <div style={{ ...typography.bodySm, color: colors.textTertiary }}>
              Complete your profile to see progress
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
