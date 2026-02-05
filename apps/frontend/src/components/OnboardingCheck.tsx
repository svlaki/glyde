import { ReactNode, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/authContext'

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

interface OnboardingCheckProps {
  children: ReactNode
}

/** Get the user-scoped localStorage key for onboarding data */
export function getOnboardingKey(userId: string): string {
  return `onboardingData_${userId}`
}

export function OnboardingCheck({ children }: OnboardingCheckProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, session } = useAuth()
  const hasCheckedServer = useRef(false)

  useEffect(() => {
    if (location.pathname === '/onboarding') {
      return
    }

    // Need user to check user-scoped onboarding status
    if (!user || !session?.access_token) {
      return
    }

    const userKey = getOnboardingKey(user.id)
    let hasCompletedOnboarding = localStorage.getItem(userKey)

    // Migrate legacy non-scoped key to user-scoped key for the current user
    if (!hasCompletedOnboarding) {
      const legacyData = localStorage.getItem('onboardingData')
      if (legacyData) {
        // Current authenticated user likely owns this data — migrate it
        localStorage.setItem(userKey, legacyData)
        localStorage.removeItem('onboardingData')
        hasCompletedOnboarding = legacyData
      }
    }

    if (hasCompletedOnboarding) {
      // User has local proof of onboarding — still check for force_reauth
      checkServer(user.id, session.access_token, userKey, navigate)
      return
    }

    // No local onboarding data for this user — check the server before redirecting
    // (handles app reinstalls, new devices, etc.)
    checkServer(user.id, session.access_token, userKey, navigate)

  }, [navigate, location.pathname, user, session])

  async function checkServer(userId: string, accessToken: string, userKey: string, nav: ReturnType<typeof useNavigate>) {
    if (hasCheckedServer.current) {
      return
    }
    hasCheckedServer.current = true

    try {
      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ user_id: userId })
      })

      if (!response.ok) {
        // Server error — if no local data, redirect to onboarding to be safe
        if (!localStorage.getItem(userKey)) {
          nav('/onboarding', { replace: true })
        }
        return
      }

      const data = await response.json()

      // Handle force_reauth
      if (data.profile?.force_reauth === true) {
        localStorage.removeItem(userKey)

        await fetch(`${API_URL}/api/profile/field`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            field: 'force_reauth',
            value: false
          })
        })

        nav('/onboarding', { replace: true })
        return
      }

      // Check if server says onboarding was completed
      // completed_at is set by both V1 and V2; display_name is a fallback indicator
      const serverOnboarded = data.profile?.context_data?.onboarding?.completed_at
        || data.profile?.display_name
      if (serverOnboarded && !localStorage.getItem(userKey)) {
        // Server knows this user onboarded — cache locally so we don't re-check
        localStorage.setItem(userKey, JSON.stringify({ restoredFromServer: true }))
        return
      }

      // No onboarding on server either — redirect to onboarding
      if (!serverOnboarded && !localStorage.getItem(userKey)) {
        nav('/onboarding', { replace: true })
      }
    } catch (error) {
      console.error('[OnboardingCheck] Error checking server:', error)
      // On error, if no local data, redirect to onboarding
      if (!localStorage.getItem(userKey)) {
        nav('/onboarding', { replace: true })
      }
    }
  }

  return <>{children}</>
}
