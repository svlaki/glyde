import { useEffect, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { initializePushNotifications } from '../lib/pushNotificationService'

export function PushNotificationInitializer() {
  const { session } = useAuth()
  const initialized = useRef(false)

  useEffect(() => {
    if (session?.access_token && !initialized.current) {
      initialized.current = true
      initializePushNotifications(session.access_token)
    }
    if (!session) {
      initialized.current = false
    }
  }, [session?.access_token])

  return null
}
