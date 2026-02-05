import { ReactNode, useEffect, useRef, useState } from 'react'
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
  const hasCheckedRef = useRef(false)
  const [status, setStatus] = useState<'checking' | 'done'>(() => {
    // Fast path: if localStorage has onboarding data, render immediately
    return localStorage.getItem('onboardingData') ? 'done' : 'checking'
  })

  useEffect(() => {
    if (location.pathname === '/onboarding') {
      return
    }

    if (!user || !session?.access_token) {
      return
    }

    // Prevent duplicate checks across re-renders
    if (hasCheckedRef.current) {
      return
    }

    const hasLocalData = localStorage.getItem('onboardingData')

    async function checkOnboardingStatus() {
      hasCheckedRef.current = true

      try {
        const response = await fetch(`${API_URL}/api/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session!.access_token}`
          },
          body: JSON.stringify({ user_id: user!.id })
        })

        if (!response.ok) {
          // If server is unreachable but we have local data, trust it
          if (hasLocalData) {
            setStatus('done')
          } else {
            // Can't verify either way — redirect to onboarding as fallback
            navigate('/onboarding', { replace: true })
          }
          return
        }

      const data = await response.json()

        // Handle force_reauth flag
        if (data.profile?.force_reauth === true) {
          console.log('[OnboardingCheck] Force reauth detected, clearing localStorage')
          localStorage.removeItem('onboardingData')

          // Clear the flag on the server
          await fetch(`${API_URL}/api/profile/field`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session!.access_token}`
            },
            body: JSON.stringify({
              field: 'force_reauth',
              value: false
            })
          })

          navigate('/onboarding', { replace: true })
          return
        }

        // If localStorage is missing, check server for completed onboarding
        if (!hasLocalData) {
          const completedAt = data.profile?.context_data?.onboarding?.completed_at
          if (completedAt) {
            console.log('[OnboardingCheck] Restoring onboarding data from server')
            // Restore a minimal localStorage entry so future checks are instant
            const restoredData = {
              fullName: data.profile.display_name || '',
              preferredName: data.profile.preferred_name || '',
              occupation: data.profile.occupation || '',
              timezone: data.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
              restoredFromServer: true
            }
            localStorage.setItem('onboardingData', JSON.stringify(restoredData))
            setStatus('done')
          } else {
            // Server also has no onboarding data — genuinely needs onboarding
            navigate('/onboarding', { replace: true })
          }
        } else {
          // localStorage exists and no force_reauth — we're good
          setStatus('done')
        }
      } catch (error) {
        console.error('[OnboardingCheck] Error checking onboarding status:', error)
        // On network error, trust localStorage if available
        if (hasLocalData) {
          setStatus('done')
        } else {
          navigate('/onboarding', { replace: true })
        }
      }
    }

    checkOnboardingStatus()
  }, [navigate, location.pathname, user, session])

  // Don't render children until we've confirmed onboarding status
  if (location.pathname !== '/onboarding' && status === 'checking') {
    return null
  }

  return <>{children}</>
}
