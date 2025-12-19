import { ReactNode, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface OnboardingCheckProps {
  children: ReactNode
}

export function OnboardingCheck({ children }: OnboardingCheckProps) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Only check if not already on onboarding page
    if (location.pathname !== '/onboarding') {
      const hasCompletedOnboarding = localStorage.getItem('onboardingData')
      if (!hasCompletedOnboarding) {
        navigate('/onboarding', { replace: true })
      }
    }
  }, [navigate, location.pathname])

  // Allow direct access to /onboarding page even if already completed
  // This lets users re-do onboarding for testing
  return <>{children}</>
}
