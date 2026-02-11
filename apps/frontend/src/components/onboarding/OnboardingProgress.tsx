import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'

interface OnboardingProgressProps {
  currentSection: 1 | 2 | 3
}

const sections = [
  { id: 1, label: 'About You' },
  { id: 2, label: 'Calendars' },
  { id: 3, label: 'Goals' }
]

export function OnboardingProgress({ currentSection }: OnboardingProgressProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      marginBottom: '32px'
    }}>
      {sections.map((section, index) => {
        const isCompleted = section.id < currentSection
        const isCurrent = section.id === currentSection
        const isUpcoming = section.id > currentSection

        return (
          <div key={section.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Step indicator */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                backgroundColor: isCompleted
                  ? '#10b981'
                  : isCurrent
                    ? '#3b82f6'
                    : colors.bgTertiary,
                color: isCompleted || isCurrent
                  ? '#ffffff'
                  : colors.textTertiary,
                border: isCurrent
                  ? '2px solid #3b82f6'
                  : '2px solid transparent'
              }}>
                {isCompleted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : section.id}
              </div>
              <span style={{
                fontSize: '12px',
                fontWeight: isCurrent ? 600 : 400,
                color: isCurrent ? colors.textPrimary : colors.textSecondary
              }}>
                {section.label}
              </span>
            </div>

            {/* Connector line */}
            {index < sections.length - 1 && (
              <div style={{
                width: '60px',
                height: '2px',
                backgroundColor: isCompleted ? '#10b981' : colors.border,
                marginBottom: '20px'
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
