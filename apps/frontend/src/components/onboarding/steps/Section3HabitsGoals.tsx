import { useDarkMode } from '../../../lib/darkModeContext'
import { getColors } from '../../../styles/colors'
import { useOnboarding } from '../OnboardingContext'
import { HABIT_OPTIONS, DEFAULT_ASPECTS } from '../../../lib/onboardingService'

export function Section3HabitsGoals() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const {
    state,
    updateField,
    addGoal,
    removeGoal,
    addAspect,
    removeAspect,
    toggleHabit
  } = useOnboarding()

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.bgSecondary,
    color: colors.textPrimary,
    fontSize: '16px',
    outline: 'none'
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: colors.textPrimary
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: '32px'
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 600,
        color: colors.textPrimary,
        marginBottom: '8px',
        textAlign: 'center'
      }}>
        Your habits and goals
      </h2>
      <p style={{
        fontSize: '14px',
        color: colors.textSecondary,
        marginBottom: '32px',
        textAlign: 'center'
      }}>
        Help us understand your lifestyle so we can better support you.
      </p>

      {/* Occupation */}
      <div style={sectionStyle}>
        <label style={labelStyle}>
          Occupation/Field <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={state.occupation}
          onChange={(e) => updateField('occupation', e.target.value)}
          placeholder="e.g., Student, Software Engineer, Teacher"
          style={inputStyle}
        />
      </div>

      {/* Field of Study (conditional) */}
      {state.isStudent && (
        <div style={sectionStyle}>
          <label style={labelStyle}>
            What do you study?
          </label>
          <input
            type="text"
            value={state.fieldOfStudy}
            onChange={(e) => updateField('fieldOfStudy', e.target.value)}
            placeholder="e.g., Computer Science, Biology, Business"
            style={inputStyle}
          />
        </div>
      )}

      {/* Life Aspects */}
      <div style={sectionStyle}>
        <label style={labelStyle}>
          What aspects of your life would you like to stay on top of? <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <p style={{
          fontSize: '12px',
          color: colors.textTertiary,
          marginBottom: '12px'
        }}>
          We've created some defaults. Feel free to edit and add your own.
        </p>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '12px'
        }}>
          {state.aspects.map(aspect => (
            <div
              key={aspect}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '20px',
                backgroundColor: isDarkMode ? '#1e3a5f' : '#eff6ff',
                border: `1px solid ${isDarkMode ? '#2563eb' : '#bfdbfe'}`,
                fontSize: '14px',
                color: colors.textPrimary
              }}
            >
              <span>{aspect}</span>
              <button
                type="button"
                onClick={() => removeAspect(aspect)}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={state.customAspect}
            onChange={(e) => updateField('customAspect', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAspect())}
            placeholder="Add custom aspect..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={addAspect}
            disabled={!state.customAspect.trim()}
            style={{
              padding: '12px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: state.customAspect.trim() ? '#3b82f6' : colors.bgTertiary,
              color: state.customAspect.trim() ? '#ffffff' : colors.textTertiary,
              fontSize: '14px',
              fontWeight: 500,
              cursor: state.customAspect.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Goals */}
      <div style={sectionStyle}>
        <label style={labelStyle}>
          Short or long term goals <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <p style={{
          fontSize: '12px',
          color: colors.textTertiary,
          marginBottom: '12px'
        }}>
          What are you currently working towards?
        </p>

        {state.goals.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '12px'
          }}>
            {state.goals.map((goal, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: colors.bgTertiary,
                  border: `1px solid ${colors.border}`
                }}
              >
                <span style={{ color: colors.textPrimary, fontSize: '14px' }}>{goal}</span>
                <button
                  type="button"
                  onClick={() => removeGoal(index)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: '18px'
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={state.currentGoal}
            onChange={(e) => updateField('currentGoal', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGoal())}
            placeholder="e.g., Learn to play guitar, Run a marathon, Raise GPA to 3.8"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={addGoal}
            disabled={!state.currentGoal.trim()}
            style={{
              padding: '12px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: state.currentGoal.trim() ? '#3b82f6' : colors.bgTertiary,
              color: state.currentGoal.trim() ? '#ffffff' : colors.textTertiary,
              fontSize: '14px',
              fontWeight: 500,
              cursor: state.currentGoal.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Habits/Personality */}
      <div style={sectionStyle}>
        <label style={labelStyle}>
          Do any of these apply to you? Select all that apply.
        </label>
        <p style={{
          fontSize: '12px',
          color: colors.textTertiary,
          marginBottom: '12px'
        }}>
          This helps us understand your productivity patterns.
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {HABIT_OPTIONS.map(habit => {
            const isSelected = state.habits.includes(habit.id)
            return (
              <button
                key={habit.id}
                type="button"
                onClick={() => toggleHabit(habit.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${isSelected ? '#3b82f6' : colors.border}`,
                  backgroundColor: isSelected ? (isDarkMode ? '#1e3a5f' : '#eff6ff') : colors.bgSecondary,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: `2px solid ${isSelected ? '#3b82f6' : colors.border}`,
                  backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span>{habit.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
