import { useState } from 'react'
import { useDarkMode } from '../../../lib/darkModeContext'
import { getColors } from '../../../styles/colors'
import { useOnboarding } from '../OnboardingContext'
import { DEFAULT_ASPECTS } from '../../../lib/onboardingService'

export function Section3HabitsGoals() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const {
    state,
    updateField,
    dispatch,
    addGoal,
    removeGoal,
    addAspect,
    removeAspect
  } = useOnboarding()

  const [expandedAspect, setExpandedAspect] = useState<string | null>(null)
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)

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
        Your goals
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
          We've created some defaults. Tap an aspect to add a description.
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '12px'
        }}>
          {state.aspects.map(aspect => {
            const isExpanded = expandedAspect === aspect
            const hasDescription = !!state.aspectDescriptions[aspect]
            return (
              <div key={aspect}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: isExpanded ? '8px 8px 0 0' : '20px',
                  backgroundColor: isDarkMode ? '#1e3a5f' : '#eff6ff',
                  border: `1px solid ${isDarkMode ? '#2563eb' : '#bfdbfe'}`,
                  borderBottom: isExpanded ? 'none' : undefined,
                  fontSize: '14px',
                  color: colors.textPrimary,
                  cursor: 'pointer',
                  transition: 'border-radius 0.15s ease',
                }}
                onClick={() => setExpandedAspect(isExpanded ? null : aspect)}
                >
                  <span style={{ flex: 1 }}>{aspect}</span>
                  {hasDescription && (
                    <span style={{
                      fontSize: '11px',
                      color: '#10b981',
                      flexShrink: 0,
                    }}>
                      described
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAspect(aspect)
                    }}
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
                      fontSize: '16px',
                      flexShrink: 0,
                    }}
                  >
                    &times;
                  </button>
                </div>
                {isExpanded && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '0 0 8px 8px',
                    backgroundColor: isDarkMode ? '#1e3a5f' : '#eff6ff',
                    border: `1px solid ${isDarkMode ? '#2563eb' : '#bfdbfe'}`,
                    borderTop: 'none',
                  }}>
                    <textarea
                      value={state.aspectDescriptions[aspect] || ''}
                      onChange={(e) => dispatch({
                        type: 'SET_ASPECT_DESCRIPTION',
                        aspect,
                        description: e.target.value,
                      })}
                      placeholder={`What does "${aspect}" mean to you? (optional)`}
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.bgSecondary,
                        color: colors.textPrimary,
                        fontSize: '13px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
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
          What are you currently working towards? Tap a goal to add details.
        </p>

        {state.goals.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '12px'
          }}>
            {state.goals.map((goal, index) => {
              const isExpanded = expandedGoal === goal
              const hasDescription = !!state.goalDescriptions[goal]
              return (
                <div key={goal}>
                  <div
                    onClick={() => setExpandedGoal(isExpanded ? null : goal)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                      backgroundColor: colors.bgTertiary,
                      border: `1px solid ${colors.border}`,
                      borderBottom: isExpanded ? 'none' : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: colors.textPrimary, fontSize: '14px' }}>{goal}</span>
                      {hasDescription && (
                        <span style={{
                          fontSize: '11px',
                          color: '#10b981',
                          flexShrink: 0,
                        }}>
                          detailed
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeGoal(index)
                      }}
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
                  {isExpanded && (
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '0 0 8px 8px',
                      backgroundColor: colors.bgTertiary,
                      border: `1px solid ${colors.border}`,
                      borderTop: 'none',
                    }}>
                      <textarea
                        value={state.goalDescriptions[goal] || ''}
                        onChange={(e) => dispatch({
                          type: 'SET_GOAL_DESCRIPTION',
                          goal,
                          description: e.target.value,
                        })}
                        placeholder="Add details: timeline, milestones, what success looks like... (optional)"
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.bgSecondary,
                          color: colors.textPrimary,
                          fontSize: '13px',
                          outline: 'none',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
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

    </div>
  )
}
