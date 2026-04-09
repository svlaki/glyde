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
 * Initialize web push notifications for browser users.
 * Registers a service worker, requests permission, subscribes to push,
 * and sends the subscription to the backend.
 */
async function initializeWebPush(accessToken: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[WEB-PUSH] Browser does not support web push')
    return
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    console.log('[WEB-PUSH] VITE_VAPID_PUBLIC_KEY not configured, skipping')
    return
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Check permission
    if (Notification.permission === 'denied') {
      console.log('[WEB-PUSH] Notification permission denied')
      return
    }

    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      trackEvent('web_push_permission_result', 'push', { status: result })
      if (result !== 'granted') return
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    // Register subscription with backend
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
    console.log('[WEB-PUSH] Successfully registered for web push notifications')
  } catch (error) {
    console.error('[WEB-PUSH] Failed to initialize web push:', error)
  }
}

export async function initializePushNotifications(accessToken: string): Promise<void> {
  console.log('[PUSH] initializePushNotifications called, isNative:', Capacitor.isNativePlatform())

  // Web browsers: use Web Push API
  if (!Capacitor.isNativePlatform()) {
    await initializeWebPush(accessToken)
    return
  }

  // Native (iOS/Android): use Capacitor Push Notifications
  try {
    const permStatus = await PushNotifications.checkPermissions()
    console.log('[PUSH] Current permission status:', permStatus.receive)

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
      console.log('[PUSH] Notification received in foreground:', notification)
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
