import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { getApiUrl } from './apiConfig'
import { trackEvent } from './analytics'

/**
 * Convert a VAPID public key from URL-safe base64 to Uint8Array
 * (required by pushManager.subscribe's applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Subscribe to web push and register the subscription with the backend.
 * Assumes permission is already granted.
 */
async function subscribeAndRegister(accessToken: string): Promise<void> {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) return

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  const apiUrl = getApiUrl()
  await fetch(`${apiUrl}/api/push/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      token: JSON.stringify(subscription),
      platform: 'web',
    }),
  })

  trackEvent('web_push_token_registered', 'push')
}

/**
 * Auto-initialize web push for browsers where permission is already granted.
 * Does NOT request permission (that must happen from a user gesture for Safari).
 */
async function initializeWebPush(accessToken: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    return
  }

  try {
    if (Notification.permission === 'granted') {
      await subscribeAndRegister(accessToken)
    }
    // If 'default' or 'denied', don't auto-request — let the banner handle it
  } catch (error) {
    console.error('[WEB-PUSH] Failed to initialize web push:', error)
  }
}

/**
 * Request notification permission (must be called from a user gesture)
 * and subscribe if granted.
 */
export async function requestWebPushPermission(accessToken: string): Promise<'granted' | 'denied' | 'default'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'denied'
  }

  try {
    const result = await Notification.requestPermission()
    trackEvent('web_push_permission_result', 'push', { status: result })

    if (result === 'granted') {
      await subscribeAndRegister(accessToken)
    }

    return result
  } catch (error) {
    console.error('[WEB-PUSH] Failed to request permission:', error)
    return 'default'
  }
}

/**
 * Check whether the push notification prompt banner should be shown.
 * Returns true only for web browsers where permission hasn't been decided yet.
 */
export function shouldShowPushPrompt(): boolean {
  if (Capacitor.isNativePlatform()) return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) return false
  if (Notification.permission !== 'default') return false
  if (localStorage.getItem('glyde-push-prompt-dismissed') === 'true') return false
  return true
}

export function dismissPushPrompt(): void {
  localStorage.setItem('glyde-push-prompt-dismissed', 'true')
}

export async function initializePushNotifications(accessToken: string): Promise<void> {
  // Web browsers: use Web Push API
  if (!Capacitor.isNativePlatform()) {
    await initializeWebPush(accessToken)
    return
  }

  // Native (iOS/Android): use Capacitor Push Notifications
  try {
    const permStatus = await PushNotifications.checkPermissions()

    if (permStatus.receive === 'prompt') {
      const result = await PushNotifications.requestPermissions()
      trackEvent('push_permission_result', 'push', { status: result.receive })

      if (result.receive !== 'granted') return
    } else if (permStatus.receive !== 'granted') {
      return
    }

    await PushNotifications.register()

    PushNotifications.addListener('registration', async (token) => {
      try {
        const apiUrl = getApiUrl()
        await fetch(`${apiUrl}/api/push/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            token: token.value,
            platform: 'ios',
          }),
        })
        trackEvent('push_token_registered', 'push')
      } catch (error) {
        console.error('[PUSH] Failed to register token with server:', error)
      }
    })

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PUSH] Registration error:', error)
      trackEvent('push_registration_error', 'push', { error: String(error) })
    })

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      trackEvent('push_notification_received', 'push', {
        type: notification.data?.type || 'unknown',
      })
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      // Navigate to reminders page when notification is tapped
      window.location.href = '/reminders'
      trackEvent('push_notification_tapped', 'push', {
        type: notification.notification.data?.type || 'unknown',
      })
    })
  } catch (error) {
    console.error('[PUSH] Failed to initialize push notifications:', error)
  }
}
