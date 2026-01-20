import { useDarkMode } from '../../../lib/darkModeContext'
import { getColors } from '../../../styles/colors'
import { useOnboarding } from '../OnboardingContext'
import { GENDER_OPTIONS } from '../../../lib/onboardingService'

export function Section1BasicInfo() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { state, updateField } = useOnboarding()

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.bgSecondary,
    color: colors.textPrimary,
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s ease'
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: colors.textPrimary
  }

  const fieldGroupStyle: React.CSSProperties = {
    marginBottom: '24px'
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 600,
        color: colors.textPrimary,
        marginBottom: '8px',
        textAlign: 'center'
      }}>
        Let's get to know you
      </h2>
      <p style={{
        fontSize: '14px',
        color: colors.textSecondary,
        marginBottom: '32px',
        textAlign: 'center'
      }}>
        Tell us a bit about yourself so we can personalize your experience.
      </p>

      {/* Full Name */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>
          Full Name <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={state.fullName}
          onChange={(e) => updateField('fullName', e.target.value)}
          placeholder="e.g., Ashley Xu"
          style={inputStyle}
        />
      </div>

      {/* Preferred Name */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>
          What do you want to be called?
        </label>
        <input
          type="text"
          value={state.preferredName}
          onChange={(e) => updateField('preferredName', e.target.value)}
          placeholder="e.g., Ashley (optional)"
          style={inputStyle}
        />
        <p style={{
          fontSize: '12px',
          color: colors.textTertiary,
          marginTop: '6px'
        }}>
          This is how we'll address you in the app
        </p>
      </div>

      {/* Birthday */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>
          Birthday <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="date"
          value={state.birthday}
          onChange={(e) => updateField('birthday', e.target.value)}
          style={inputStyle}
          max={new Date().toISOString().split('T')[0]}
        />
        <p style={{
          fontSize: '12px',
          color: colors.textTertiary,
          marginTop: '6px'
        }}>
          This helps us understand your life stage
        </p>
      </div>

      {/* Gender */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>
          Gender <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          {GENDER_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateField('gender', option.value)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: `1px solid ${state.gender === option.value ? '#3b82f6' : colors.border}`,
                backgroundColor: state.gender === option.value ? '#3b82f6' : colors.bgSecondary,
                color: state.gender === option.value ? '#ffffff' : colors.textPrimary,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
