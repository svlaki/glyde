import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'
import { useAuth } from '../lib/authContext'
import { completeOnboarding, PreferencesData } from '../lib/onboardingService'
import { uploadICSFile, getGoogleAuthUrl, getMicrosoftAuthUrl } from '../lib/calendarService'

interface OnboardingData {
  name: string
  occupation: string
  goals: string[]
  aspects: string[]
  timezone: string
  preferences: PreferencesData
}

const PRESET_ASPECTS = ['Personal', 'Health', 'Work']

export function Onboarding() {
  const navigate = useNavigate()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { user, session } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form data - Steps 1-3
  const [name, setName] = useState('')
  const [occupation, setOccupation] = useState('')
  const [currentGoal, setCurrentGoal] = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [selectedAspects, setSelectedAspects] = useState<string[]>(PRESET_ASPECTS)
  const [customAspect, setCustomAspect] = useState('')

  // Step 4: Timezone
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  )

  // Step 5: Preferences
  const [workHoursStart, setWorkHoursStart] = useState('09:00')
  const [workHoursEnd, setWorkHoursEnd] = useState('17:00')
  const [flexibleHours, setFlexibleHours] = useState(false)
  const [communicationStyle, setCommunicationStyle] = useState<'direct' | 'collaborative' | 'formal' | 'casual'>('collaborative')
  const [focusDuration, setFocusDuration] = useState(90)
  const [meetingPreference, setMeetingPreference] = useState<'morning' | 'afternoon' | 'flexible'>('flexible')

  // Step 6: Calendar import
  const [calendarImported, setCalendarImported] = useState(false)
  const [importedEventCount, setImportedEventCount] = useState(0)

  const totalSteps = 7

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
    if (!user || !session?.access_token) {
      setError('You must be logged in to complete onboarding')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const preferences: PreferencesData = {
        work_hours: {
          start: workHoursStart,
          end: workHoursEnd,
          flexible: flexibleHours
        },
        communication: {
          style: communicationStyle,
          preferred_channels: ['chat', 'email']
        },
        productivity: {
          focus_block_duration: focusDuration,
          break_frequency: 60,
          meeting_preference: meetingPreference,
          deep_work_time: 'morning'
        }
      }

      const onboardingData: OnboardingData = {
        name,
        occupation,
        goals,
        aspects: selectedAspects,
        timezone,
        preferences
      }

      const result = await completeOnboarding(user, session.access_token, onboardingData)

      if (result.success) {
        localStorage.setItem('onboardingData', JSON.stringify(onboardingData))
        navigate('/calendar', { replace: true })
      } else {
        setError(result.error || 'Failed to complete onboarding')
      }
    } catch (error: any) {
      console.error('Error completing onboarding:', error)
      setError(error.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !session?.access_token) {
      setError('You must be logged in to upload calendar')
      return
    }

    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const result = await uploadICSFile(user, session.access_token, file)
      if (result.success && result.eventCount) {
        setCalendarImported(true)
        setImportedEventCount(result.eventCount)
      } else {
        setError(result.error || 'Failed to upload calendar')
      }
    } catch (error: any) {
      console.error('Error uploading calendar:', error)
      setError(error.message || 'Failed to upload calendar')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleCalendar = async () => {
    if (!user || !session?.access_token) {
      setError('You must be logged in to connect Google Calendar')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await getGoogleAuthUrl(user, session.access_token)
      if (result.success && result.authUrl) {
        // Redirect to Google OAuth
        window.location.href = result.authUrl
      } else {
        setError(result.error || 'Failed to get Google auth URL')
        setLoading(false)
      }
    } catch (error: any) {
      console.error('Error initiating Google OAuth:', error)
      setError(error.message || 'Failed to connect Google Calendar')
      setLoading(false)
    }
  }

  const handleMicrosoftCalendar = async () => {
    if (!user || !session?.access_token) {
      setError('You must be logged in to connect Microsoft Calendar')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await getMicrosoftAuthUrl(user, session.access_token)
      if (result.success && result.authUrl) {
        // Redirect to Microsoft OAuth
        window.location.href = result.authUrl
      } else {
        setError(result.error || 'Failed to get Microsoft auth URL')
        setLoading(false)
      }
    } catch (error: any) {
      console.error('Error initiating Microsoft OAuth:', error)
      setError(error.message || 'Failed to connect Microsoft Calendar')
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
      case 4:
        return timezone.trim().length > 0
      case 5:
        return true // Preferences have defaults
      case 6:
        return true // Calendar import is optional
      case 7:
        return true // Categories step (simplified, always valid)
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

          {/* Step 4: Timezone */}
          {currentStep === 4 && (
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.textPrimary,
                marginBottom: '8px'
              }}>
                Select your timezone
              </h2>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                marginBottom: '20px'
              }}>
                We've auto-detected your timezone. You can change it if needed.
              </p>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: colors.textSecondary,
                  marginBottom: '6px'
                }}>
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '14px',
                    background: colors.bgPrimary,
                    color: colors.textPrimary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px'
                  }}
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                  <option value="Australia/Sydney">Sydney (AEST)</option>
                </select>
                <p style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  marginTop: '8px'
                }}>
                  Current time: {new Date().toLocaleTimeString('en-US', { timeZone: timezone })}
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Preferences */}
          {currentStep === 5 && (
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.textPrimary,
                marginBottom: '8px'
              }}>
                Work preferences
              </h2>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                marginBottom: '20px'
              }}>
                Help us understand how you work best
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: '6px'
                  }}>
                    Work hours
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="time"
                      value={workHoursStart}
                      onChange={(e) => setWorkHoursStart(e.target.value)}
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
                    <span style={{ color: colors.textSecondary }}>to</span>
                    <input
                      type="time"
                      value={workHoursEnd}
                      onChange={(e) => setWorkHoursEnd(e.target.value)}
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
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={flexibleHours}
                      onChange={(e) => setFlexibleHours(e.target.checked)}
                    />
                    <span style={{ fontSize: '14px', color: colors.textPrimary }}>
                      I have flexible work hours
                    </span>
                  </label>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: '6px'
                  }}>
                    Communication style
                  </label>
                  <select
                    value={communicationStyle}
                    onChange={(e) => setCommunicationStyle(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '14px',
                      background: colors.bgPrimary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px'
                    }}
                  >
                    <option value="direct">Direct</option>
                    <option value="collaborative">Collaborative</option>
                    <option value="formal">Formal</option>
                    <option value="casual">Casual</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: '6px'
                  }}>
                    Focus block duration: {focusDuration} minutes
                  </label>
                  <input
                    type="range"
                    min="30"
                    max="180"
                    step="15"
                    value={focusDuration}
                    onChange={(e) => setFocusDuration(parseInt(e.target.value))}
                    style={{ width: '100%' }}
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
                    Meeting preference
                  </label>
                  <select
                    value={meetingPreference}
                    onChange={(e) => setMeetingPreference(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '14px',
                      background: colors.bgPrimary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px'
                    }}
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Calendar Import */}
          {currentStep === 6 && (
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.textPrimary,
                marginBottom: '8px'
              }}>
                Import your calendar (optional)
              </h2>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                marginBottom: '20px'
              }}>
                Connect your calendar to analyze your work patterns
              </p>

              {!calendarImported ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Google Calendar */}
                  <button
                    type="button"
                    onClick={handleGoogleCalendar}
                    disabled={loading}
                    style={{
                      padding: '16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      background: colors.bgPrimary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = colors.bgPrimary
                    }}
                  >
                    <span>📅</span> Connect Google Calendar
                  </button>

                  {/* Microsoft Calendar */}
                  <button
                    type="button"
                    onClick={handleMicrosoftCalendar}
                    disabled={loading}
                    style={{
                      padding: '16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      background: colors.bgPrimary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = colors.bgPrimary
                    }}
                  >
                    <span>📆</span> Connect Outlook/Microsoft 365
                  </button>

                  {/* ICS File Upload */}
                  <label
                    htmlFor="calendar-upload"
                    style={{
                      padding: '16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      background: colors.bgPrimary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = colors.bgPrimary
                    }}
                  >
                    <span>📄</span> Upload .ics File
                  </label>
                  <input
                    id="calendar-upload"
                    type="file"
                    accept=".ics"
                    onChange={handleFileUpload}
                    disabled={loading}
                    style={{ display: 'none' }}
                  />

                  <p style={{
                    textAlign: 'center',
                    fontSize: '12px',
                    color: colors.textSecondary,
                    marginTop: '8px'
                  }}>
                    Or skip this step - you can import later in settings
                  </p>
                </div>
              ) : (
                <div style={{
                  padding: '24px',
                  background: '#22c55e',
                  color: '#fff',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <p style={{ fontSize: '16px', fontWeight: '500' }}>
                    ✓ Calendar imported successfully!
                  </p>
                  <p style={{ fontSize: '14px', marginTop: '4px' }}>
                    {importedEventCount} events imported
                  </p>
                </div>
              )}

              {error && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 7: Categories (Simplified) */}
          {currentStep === 7 && (
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.textPrimary,
                marginBottom: '8px'
              }}>
                You're all set!
              </h2>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                marginBottom: '20px'
              }}>
                We've created default categories for you. You can customize them later in settings.
              </p>

              <div style={{
                padding: '24px',
                background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                borderRadius: '8px'
              }}>
                <p style={{ fontSize: '14px', color: colors.textPrimary }}>
                  Default categories created:
                </p>
                <ul style={{
                  marginTop: '12px',
                  paddingLeft: '20px',
                  color: colors.textSecondary,
                  fontSize: '13px'
                }}>
                  <li>Work, School, Health & Hygiene</li>
                  <li>Social, Family, Personal</li>
                  <li>Fitness, Hobbies, Finance</li>
                  <li>Shopping, Travel, Self-Care</li>
                </ul>
              </div>

              {error && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}
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
