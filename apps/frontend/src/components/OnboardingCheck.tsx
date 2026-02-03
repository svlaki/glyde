import { ReactNode, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/authContext'

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

interface OnboardingCheckProps {
  children: ReactNode
}

export function OnboardingCheck({ children }: OnboardingCheckProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, session } = useAuth()
  const hasCheckedForceReauth = useRef(false)

  useEffect(() => {
    // Only check if not already on onboarding page
    if (location.pathname === '/onboarding') {
      return
    }

    const hasCompletedOnboarding = localStorage.getItem('onboardingData')
    if (!hasCompletedOnboarding) {
      navigate('/onboarding', { replace: true })
      return
    }

    // Check for force_reauth flag from server (only once per session)
    async function checkForceReauth() {
      if (!user || !session?.access_token || hasCheckedForceReauth.current) {
        return
      }

      hasCheckedForceReauth.current = true

      try {
        const response = await fetch(`${API_URL}/api/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ user_id: user.id })
        })

        if (!response.ok) return

        const data = await response.json()

        if (data.profile?.force_reauth === true) {
          console.log('[OnboardingCheck] Force reauth detected, clearing localStorage')

          // Clear localStorage onboarding data
          localStorage.removeItem('onboardingData')

          // Clear the force_reauth flag in the profile
          await fetch(`${API_URL}/api/profile/field`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              field: 'force_reauth',
              value: false
            })
          })

          // Redirect to onboarding
          navigate('/onboarding', { replace: true })
        }
      } catch (error) {
        console.error('[OnboardingCheck] Error checking force_reauth:', error)
      }
    }

    checkForceReauth()
  }, [navigate, location.pathname, user, session])

  // Allow direct access to /onboarding page even if already completed
  // This lets users re-do onboarding for testing
  return <>{children}</>
}
