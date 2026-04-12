import { useState } from 'react'
import { useAuth } from '../lib/authContext'
import {
  requestWebPushPermission,
  shouldShowPushPrompt,
  dismissPushPrompt,
} from '../lib/pushNotificationService'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'
import { fontFamily, fontWeight, fontSize } from '../styles/typography'

export function PushNotificationBanner() {
  const { session } = useAuth()
  const { theme } = useTheme()
  const colors = getColors(theme)
  const [visible, setVisible] = useState(() => shouldShowPushPrompt())
  const [requesting, setRequesting] = useState(false)

  if (!visible || !session?.access_token) return null

  const handleEnable = async () => {
    setRequesting(true)
    try {
      const result = await requestWebPushPermission(session.access_token)
      if (result !== 'default') {
        setVisible(false)
      }
    } finally {
      setRequesting(false)
    }
  }

  const handleDismiss = () => {
    dismissPushPrompt()
    setVisible(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 50,
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        backgroundColor: colors.bgSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: '20px 24px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <h3
          style={{
            fontFamily: fontFamily.serif,
            fontSize: fontSize.xl,
            fontWeight: fontWeight.semibold,
            color: colors.textPrimary,
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          Stay in the loop
        </h3>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: colors.textTertiary,
            padding: 4,
            marginTop: -2,
            marginRight: -4,
            lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <p
        style={{
          fontFamily: fontFamily.sans,
          fontSize: fontSize.base,
          color: colors.textSecondary,
          margin: '0 0 16px',
          lineHeight: 1.5,
        }}
      >
        Enable notifications so you never miss a reminder or upcoming event.
      </p>
      <button
        onClick={handleEnable}
        disabled={requesting}
        style={{
          fontFamily: fontFamily.sans,
          fontSize: fontSize.base,
          fontWeight: fontWeight.medium,
          backgroundColor: colors.accent,
          color: colors.bgPrimary,
          border: 'none',
          borderRadius: 8,
          padding: '10px 20px',
          cursor: requesting ? 'default' : 'pointer',
          opacity: requesting ? 0.6 : 1,
          width: '100%',
          transition: 'opacity 0.15s ease',
        }}
      >
        {requesting ? 'Enabling...' : 'Enable notifications'}
      </button>
    </div>
  )
}
