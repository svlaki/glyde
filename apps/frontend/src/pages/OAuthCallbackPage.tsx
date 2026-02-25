import { useEffect, useState } from 'react'
import { useAuth } from '../lib/authContext'
import { importGoogleCalendar } from '../lib/calendarService'

export function OAuthCallbackPage() {
  const { user, session } = useAuth()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Processing...')

  useEffect(() => {
    async function handleCallback() {
      // Extract code and state from URL
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const error = params.get('error')

      // Handle Google OAuth errors (user denied access, etc.)
      if (error) {
        setStatus('error')
        setMessage(error === 'access_denied' ? 'Access denied' : error)
        sendMessage({ type: 'CALENDAR_IMPORT_ERROR', error })
        return
      }

      if (!code || !state) {
        setStatus('error')
        setMessage('Missing authorization code')
        sendMessage({ type: 'CALENDAR_IMPORT_ERROR', error: 'Missing authorization code' })
        return
      }

      // Parse state to determine flow type and provider
      let flow = 'onboarding'
      let userId = state
      let provider = 'google'
      try {
        const stateData = JSON.parse(state)
        flow = stateData.flow || 'onboarding'
        userId = stateData.userId || state
        provider = stateData.provider || 'google'
      } catch {
        // State is just the userId string (legacy format)
      }

      // Connection flow: just relay code back to opener, no auth needed in popup
      if (flow === 'connection') {
        setStatus('success')
        setMessage('Calendar connected!')
        const messageType = provider === 'microsoft'
          ? 'MICROSOFT_CONNECTION_CALLBACK'
          : 'GOOGLE_CONNECTION_CALLBACK'
        sendMessage({
          type: messageType,
          code,
          state
        })
        return
      }

      // Onboarding/import flow requires auth
      if (!user || !session?.access_token) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      if (!user || !session?.access_token) {
        setStatus('error')
        setMessage('Authentication required')
        sendMessage({ type: 'CALENDAR_IMPORT_ERROR', error: 'Authentication required' })
        return
      }

      setMessage('Importing your calendar...')
      try {
        const result = await importGoogleCalendar(user, session.access_token, code, userId)

        if (result.success) {
          setStatus('success')
          setMessage(`Imported ${result.eventCount || 0} events!`)
          sendMessage({
            type: 'CALENDAR_IMPORT_SUCCESS',
            eventCount: result.eventCount || 0
          })
        } else {
          setStatus('error')
          setMessage(result.error || 'Import failed')
          sendMessage({
            type: 'CALENDAR_IMPORT_ERROR',
            error: result.error || 'Import failed'
          })
        }
      } catch (err: any) {
        setStatus('error')
        setMessage(err.message || 'Import failed')
        sendMessage({
          type: 'CALENDAR_IMPORT_ERROR',
          error: err.message || 'Import failed'
        })
      }
    }

    handleCallback()
  }, [user, session])

  function sendMessage(data: { type: string; code?: string; state?: string; eventCount?: number; error?: string }) {
    // Send message to parent/opener window
    // Use '*' for target origin because the popup may land on a different origin
    // than the opener (e.g., production redirect URI while running locally).
    // The data only contains a one-time OAuth code, not sensitive credentials.
    if (window.opener) {
      window.opener.postMessage(data, '*')
    }

    // Auto-close after a brief delay
    setTimeout(() => {
      window.close()
    }, 2000)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px'
    }}>
      {status === 'processing' && (
        <>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #3b82f6',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }} />
          <p style={{ fontSize: '16px', color: '#94a3b8' }}>{message}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p style={{ fontSize: '16px', color: '#10b981' }}>{message}</p>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>
            This window will close automatically...
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p style={{ fontSize: '16px', color: '#ef4444' }}>{message}</p>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>
            This window will close automatically...
          </p>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
