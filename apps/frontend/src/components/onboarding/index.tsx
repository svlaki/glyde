import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
import { useAuth } from '../../lib/authContext'
import { usePlatform } from '../../hooks/usePlatform'
import { completeOnboardingV2, OnboardingDataV2 } from '../../lib/onboardingService'
import { getOnboardingKey } from '../OnboardingCheck'

import { OnboardingProvider, useOnboarding } from './OnboardingContext'
import { OnboardingProgress } from './OnboardingProgress'
import { Section1BasicInfo } from './steps/Section1BasicInfo'
import { Section2Calendars } from './steps/Section2Calendars'
import { Section3HabitsGoals } from './steps/Section3HabitsGoals'
import { TimezoneConfirm } from './components/TimezoneConfirm'

function OnboardingContent() {
  const navigate = useNavigate()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { user, session } = useAuth()
  const { isMobile } = usePlatform()
  const {
    state,
    dispatch,
    nextSection,
    prevSection,
    canProceedSection1,
    canProceedSection2,
    canProceedSection3
  } = useOnboarding()

  const [showTimezone, setShowTimezone] = useState(false)

  const canProceed = () => {
    switch (state.currentSection) {
      case 1: return canProceedSection1()
      case 2: return canProceedSection2()
      case 3: return canProceedSection3()
      default: return false
    }
  }

  const handleNext = () => {
    if (state.currentSection === 3) {
      // Show timezone confirmation before completing
      setShowTimezone(true)
    } else {
      nextSection()
    }
  }

  const handleComplete = async () => {
    if (!user || !session?.access_token) {
      dispatch({ type: 'SET_ERROR', error: 'You must be logged in to complete onboarding' })
      return
    }

    dispatch({ type: 'SET_LOADING', loading: true })
    dispatch({ type: 'SET_ERROR', error: null })

    try {
      const onboardingData: OnboardingDataV2 = {
        fullName: state.fullName,
        preferredName: state.preferredName || undefined,
        birthday: state.birthday,
        gender: state.gender,
        selectedCalendars: state.selectedCalendars,
        otherCalendar: state.otherCalendar || undefined,
        occupation: state.occupation,
        fieldOfStudy: state.isStudent ? state.fieldOfStudy : undefined,
        aspects: state.aspects,
        goals: state.goals,
        habits: state.habits,
        timezone: state.timezone
      }

      const result = await completeOnboardingV2(user, session.access_token, onboardingData)

      if (result.success) {
        // Save to user-scoped localStorage for OnboardingCheck
        localStorage.setItem(getOnboardingKey(user.id), JSON.stringify(onboardingData))
        navigate('/calendar', { replace: true })
      } else {
        dispatch({ type: 'SET_ERROR', error: result.error || 'Failed to complete onboarding' })
      }
    } catch (error: any) {
      console.error('Error completing onboarding:', error)
      dispatch({ type: 'SET_ERROR', error: error.message || 'An unexpected error occurred' })
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false })
    }
  }

  // Show timezone confirmation overlay
  if (showTimezone) {
    return (
      <div style={{
        height: '100vh',
        maxHeight: '100vh',
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        backgroundColor: colors.bgPrimary
      }}>
        <div style={{
          flex: 1,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch' as const,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          paddingTop: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 20px)' : '20px',
          paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 20px)' : '20px'
        }}>
          <TimezoneConfirm onConfirm={handleComplete} />
        </div>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh',
      maxHeight: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
      backgroundColor: colors.bgPrimary
    }}>
      <div style={{
        flex: 1,
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch' as const,
        minHeight: 0,
        padding: '40px 20px',
        paddingTop: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 48px)' : '40px',
        paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 40px)' : '40px'
      }}>
        <div style={{
          maxWidth: '640px',
          margin: '0 auto'
        }}>
        {/* Header */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: colors.textPrimary,
            marginBottom: '8px'
          }}>
            Welcome to Glyde
          </h1>
          <p style={{
            fontSize: '14px',
            color: colors.textSecondary
          }}>
            Let's set up your account in just a few steps
          </p>
        </div>

        {/* Progress */}
        <OnboardingProgress currentSection={state.currentSection} />

        {/* Error message */}
        {state.error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '14px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            {state.error}
          </div>
        )}

        {/* Section content */}
        <div style={{
          backgroundColor: colors.bgSecondary,
          borderRadius: '16px',
          padding: '32px',
          border: `1px solid ${colors.border}`,
          marginBottom: '24px'
        }}>
          {state.currentSection === 1 && <Section1BasicInfo />}
          {state.currentSection === 2 && <Section2Calendars />}
          {state.currentSection === 3 && <Section3HabitsGoals />}
        </div>

        {/* Navigation buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <button
            type="button"
            onClick={prevSection}
            disabled={state.currentSection === 1}
            style={{
              padding: '14px 28px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              backgroundColor: state.currentSection === 1 ? colors.bgTertiary : colors.bgSecondary,
              color: state.currentSection === 1 ? colors.textTertiary : colors.textPrimary,
              fontSize: '16px',
              fontWeight: 500,
              cursor: state.currentSection === 1 ? 'not-allowed' : 'pointer',
              opacity: state.currentSection === 1 ? 0.5 : 1
            }}
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed() || state.loading}
            style={{
              padding: '14px 28px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: canProceed() && !state.loading ? '#3b82f6' : colors.bgTertiary,
              color: canProceed() && !state.loading ? '#ffffff' : colors.textTertiary,
              fontSize: '16px',
              fontWeight: 500,
              cursor: canProceed() && !state.loading ? 'pointer' : 'not-allowed',
              minWidth: '120px'
            }}
          >
            {state.loading ? 'Loading...' : state.currentSection === 3 ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

export function Onboarding() {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  )
}

export default Onboarding
