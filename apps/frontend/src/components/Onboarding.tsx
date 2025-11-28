import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'

interface OnboardingData {
  name: string
  occupation: string
  goals: string[]
  aspects: string[]
}

const PRESET_ASPECTS = ['Personal', 'Health', 'Work']

export function Onboarding() {
  const navigate = useNavigate()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Form data
  const [name, setName] = useState('')
  const [occupation, setOccupation] = useState('')
  const [currentGoal, setCurrentGoal] = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [selectedAspects, setSelectedAspects] = useState<string[]>(PRESET_ASPECTS)
  const [customAspect, setCustomAspect] = useState('')

  const totalSteps = 3

  const handleAddGoal = () => {
    if (currentGoal.trim()) {
      setGoals([...goals, currentGoal.trim()])
      setCurrentGoal('')
    }
  }

  const handleRemoveGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index))
  }

  const handleToggleAspect = (aspect: string) => {
    if (selectedAspects.includes(aspect)) {
      setSelectedAspects(selectedAspects.filter(a => a !== aspect))
    } else {
      setSelectedAspects([...selectedAspects, aspect])
    }
  }

  const handleAddCustomAspect = () => {
    if (customAspect.trim() && !selectedAspects.includes(customAspect.trim())) {
      setSelectedAspects([...selectedAspects, customAspect.trim()])
      setCustomAspect('')
    }
  }

  const handleRemoveAspect = (aspect: string) => {
    if (!PRESET_ASPECTS.includes(aspect)) {
      setSelectedAspects(selectedAspects.filter(a => a !== aspect))
    }
  }

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    setLoading(true)
    try {
      // Store onboarding data in localStorage for now
      // Backend integration would happen here
      const onboardingData: OnboardingData = {
        name,
        occupation,
        goals,
        aspects: selectedAspects
      }
      localStorage.setItem('onboardingData', JSON.stringify(onboardingData))

      // Navigate to calendar
      navigate('/calendar', { replace: true })
    } catch (error) {
      console.error('Error completing onboarding:', error)
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return name.trim().length > 0 && occupation.trim().length > 0
      case 2:
        return goals.length > 0
      case 3:
        return selectedAspects.length > 0
      default:
        return false
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isDarkMode ? '#0a0a0a' : '#fafafa',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        background: colors.bgPrimary,
        borderRadius: '12px',
        boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.5)' : '0 2px 10px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '30px 40px 20px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: colors.textPrimary,
            marginBottom: '8px'
          }}>
            Welcome to Glyde
          </h1>
          <p style={{
            fontSize: '14px',
            color: colors.textSecondary
          }}>
            Let's get you set up with your personal intelligence system
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          padding: '20px 40px',
          background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px'
          }}>
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: index < currentStep ? '#3b82f6' : colors.border,
                  transition: 'background 0.3s ease'
                }}
              />
            ))}
          </div>
          <p style={{
            fontSize: '12px',
            color: colors.textSecondary,
            textAlign: 'right'
          }}>
            Step {currentStep} of {totalSteps}
          </p>
        </div>

        {/* Content */}
        <div style={{
          padding: '30px 40px 40px'
        }}>
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.textPrimary,
                marginBottom: '20px'
              }}>
                Tell us about yourself
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: '6px'
                  }}>
                    What's your name?
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '14px',
                      background: colors.bgPrimary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: '6px'
                  }}>
                    What do you do?
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="Software Engineer, Student, Entrepreneur..."
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '14px',
                      background: colors.bgPrimary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Goals */}
          {currentStep === 2 && (
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.textPrimary,
                marginBottom: '8px'
              }}>
                What are your goals?
              </h2>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                marginBottom: '20px'
              }}>
                Share what you want to accomplish. Be as specific as you'd like.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={currentGoal}
                    onChange={(e) => setCurrentGoal(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddGoal()
                      }
                    }}
                    placeholder="e.g., Learn to play guitar, Run a marathon, Start a business..."
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      fontSize: '14px',
                      background: colors.bgPrimary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddGoal}
                    disabled={!currentGoal.trim()}
                    style={{
                      padding: '12px 20px',
                      fontSize: '14px',
                      fontWeight: '500',
                      background: currentGoal.trim() ? '#3b82f6' : colors.bgHover,
                      color: currentGoal.trim() ? '#fff' : colors.textSecondary,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: currentGoal.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s'
                    }}
                  >
                    Add
                  </button>
                </div>

                {goals.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '8px'
                  }}>
                    {goals.map((goal, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 14px',
                          background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`
                        }}
                      >
                        <span style={{
                          flex: 1,
                          fontSize: '14px',
                          color: colors.textPrimary
                        }}>
                          {goal}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGoal(index)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            background: 'transparent',
                            color: colors.textSecondary,
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: '4px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = colors.bgHover
                            e.currentTarget.style.color = '#ef4444'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = colors.textSecondary
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {goals.length === 0 && (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    color: colors.textSecondary,
                    fontSize: '14px'
                  }}>
                    Add your first goal to continue
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Life Aspects */}
          {currentStep === 3 && (
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.textPrimary,
                marginBottom: '8px'
              }}>
                Choose your life aspects
              </h2>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                marginBottom: '20px'
              }}>
                We've selected some common aspects. Add or remove as needed.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Preset aspects */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  {PRESET_ASPECTS.map((aspect) => (
                    <button
                      key={aspect}
                      type="button"
                      onClick={() => handleToggleAspect(aspect)}
                      style={{
                        padding: '10px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        background: selectedAspects.includes(aspect) ? '#3b82f6' : colors.bgPrimary,
                        color: selectedAspects.includes(aspect) ? '#fff' : colors.textPrimary,
                        border: `1px solid ${selectedAspects.includes(aspect) ? '#3b82f6' : colors.border}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {aspect}
                    </button>
                  ))}
                </div>

                {/* Custom aspects */}
                {selectedAspects.filter(a => !PRESET_ASPECTS.includes(a)).length > 0 && (
                  <div>
                    <p style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: colors.textSecondary,
                      marginBottom: '8px'
                    }}>
                      Custom Aspects
                    </p>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      {selectedAspects
                        .filter(a => !PRESET_ASPECTS.includes(a))
                        .map((aspect) => (
                          <div
                            key={aspect}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 16px',
                              fontSize: '14px',
                              fontWeight: '500',
                              background: '#3b82f6',
                              color: '#fff',
                              border: '1px solid #3b82f6',
                              borderRadius: '8px'
                            }}
                          >
                            {aspect}
                            <button
                              type="button"
                              onClick={() => handleRemoveAspect(aspect)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                cursor: 'pointer',
                                padding: '0',
                                fontSize: '16px',
                                lineHeight: '1'
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Add custom aspect */}
                <div>
                  <p style={{
                    fontSize: '13px',
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: '8px'
                  }}>
                    Add Custom Aspect
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={customAspect}
                      onChange={(e) => setCustomAspect(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomAspect()
                        }
                      }}
                      placeholder="e.g., Finance, Relationships, Learning..."
                      style={{
                        flex: 1,
                        padding: '12px 14px',
                        fontSize: '14px',
                        background: colors.bgPrimary,
                        color: colors.textPrimary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomAspect}
                      disabled={!customAspect.trim()}
                      style={{
                        padding: '12px 20px',
                        fontSize: '14px',
                        fontWeight: '500',
                        background: customAspect.trim() ? '#3b82f6' : colors.bgHover,
                        color: customAspect.trim() ? '#fff' : colors.textSecondary,
                        border: 'none',
                        borderRadius: '8px',
                        cursor: customAspect.trim() ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s'
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div style={{
          padding: '20px 40px',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              background: 'transparent',
              color: currentStep === 1 ? colors.textSecondary : colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 1 ? 0.5 : 1
            }}
          >
            Back
          </button>

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: '500',
                background: canProceed() ? '#3b82f6' : colors.bgHover,
                color: canProceed() ? '#fff' : colors.textSecondary,
                border: 'none',
                borderRadius: '8px',
                cursor: canProceed() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={!canProceed() || loading}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: '500',
                background: (canProceed() && !loading) ? '#22c55e' : colors.bgHover,
                color: (canProceed() && !loading) ? '#fff' : colors.textSecondary,
                border: 'none',
                borderRadius: '8px',
                cursor: (canProceed() && !loading) ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Completing...' : 'Get Started'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
