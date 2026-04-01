import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { getApiUrl } from './apiConfig'
import { trackEvent } from './analytics'

export async function initializePushNotifications(accessToken: string): Promise<void> {
  console.log('[PUSH] initializePushNotifications called, isNative:', Capacitor.isNativePlatform())
  if (!Capacitor.isNativePlatform()) return

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
