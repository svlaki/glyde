import { useState, useRef, useCallback, useEffect } from 'react'
import { useTheme } from '../../../lib/themeContext'
import { getColors } from '../../../styles/colors'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '../../../lib/authContext'
import {
  uploadICSFile,
  getGoogleAuthUrl as getImportAuthUrl,
} from '../../../lib/calendarService'
import {
  getGoogleAuthUrl as getSyncAuthUrl,
  handleGoogleCallback,
  fetchCalendarMappings,
} from '../../../lib/connectionService'
import { GoogleCalendarPicker } from './GoogleCalendarPicker'

type CalendarMode = 'sync' | 'import'
type ConnectStatus = 'idle' | 'connecting' | 'polling' | 'connected' | 'error'
type ImportStatus = 'idle' | 'connecting' | 'importing' | 'success' | 'error'

export function Section2Calendars() {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const { state, dispatch } = useOnboarding()
  const { user, session } = useAuth()

  const [calendarMode, setCalendarMode] = useState<CalendarMode>('sync')

  // Sync flow state
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>(
    state.googleConnected ? 'connected' : 'idle'
  )
  const [connectError, setConnectError] = useState<string | null>(null)
  const [mappingsLoading, setMappingsLoading] = useState(false)

  // Import flow state
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle')
  const [importError, setImportError] = useState<string | null>(null)
  const [importedEventCount, setImportedEventCount] = useState(0)

  // ICS upload state
  const [fileUploadStatus, setFileUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadedFileEventCount, setUploadedFileEventCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Listen for OAuth callback from popup (handles both flows)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return

      // Connection (sync) flow callback
      if (event.data?.type === 'GOOGLE_CONNECTION_CALLBACK') {
        const { code, state: oauthState } = event.data
        if (code && oauthState) {
          handleSyncCallback(code, oauthState)
        }
      }

      // Import flow callbacks
      if (event.data?.type === 'CALENDAR_IMPORT_SUCCESS') {
        setImportStatus('success')
        setImportedEventCount(event.data.eventCount || 0)
        dispatch({
          type: 'SET_CALENDAR_IMPORT_STATUS',
          status: 'success',
          eventCount: event.data.eventCount || 0,
        })
      }

      if (event.data?.type === 'CALENDAR_IMPORT_ERROR') {
        setImportStatus('error')
        setImportError(event.data.error || 'Import failed')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [user, session])

  // --- Sync flow handlers ---

  const handleSyncCallback = useCallback(async (code: string, oauthState: string) => {
    if (!user || !session?.access_token) return

    setConnectStatus('connecting')
    setConnectError(null)

    try {
      const result = await handleGoogleCallback(user, code, oauthState, session.access_token)

      if (result.error || !result.connection) {
        setConnectStatus('error')
        setConnectError(result.error || 'Failed to connect Google Calendar')
        return
      }

      const connectionId = result.connection.id

      // Poll for calendar mappings (backend creates them async)
      setConnectStatus('polling')
      setMappingsLoading(true)

      let mappings = null
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000))

        const mappingsResult = await fetchCalendarMappings(user, connectionId, session.access_token)
        if (mappingsResult.mappings && mappingsResult.mappings.length > 0) {
          mappings = mappingsResult.mappings
          break
        }
      }

      setMappingsLoading(false)

      if (mappings && mappings.length > 0) {
        dispatch({
          type: 'SET_GOOGLE_CONNECTION',
          connectionId,
          mappings,
        })
        setConnectStatus('connected')
      } else {
        dispatch({
          type: 'SET_GOOGLE_CONNECTION',
          connectionId,
          mappings: [],
        })
        setConnectStatus('connected')
      }
    } catch (err: any) {
      setConnectStatus('error')
      setConnectError(err.message || 'Connection failed')
      setMappingsLoading(false)
    }
  }, [user, session, dispatch])

  const handleConnectGoogle = useCallback(async () => {
    if (!user || !session?.access_token) return

    setConnectStatus('connecting')
    setConnectError(null)

    try {
      const result = await getSyncAuthUrl(user, session.access_token)

      if (result.error || !result.authUrl) {
        setConnectStatus('error')
        setConnectError(result.error || 'Failed to get auth URL')
        return
      }

      const popup = window.open(result.authUrl, 'google-oauth', 'width=600,height=700')

      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup)
          setConnectStatus(prev => prev === 'connecting' ? 'idle' : prev)
        }
      }, 500)
    } catch (err: any) {
      setConnectStatus('error')
      setConnectError(err.message || 'Failed to start connection')
    }
  }, [user, session])

  // --- Import flow handlers ---

  const handleImportGoogle = useCallback(async () => {
    if (!user || !session?.access_token) return

    setImportStatus('connecting')
    setImportError(null)

    try {
      const result = await getImportAuthUrl(user, session.access_token)

      if (!result.success || !result.authUrl) {
        setImportStatus('error')
        setImportError(result.error || 'Failed to get auth URL')
        return
      }

      setImportStatus('importing')

      const popup = window.open(result.authUrl, 'google-oauth', 'width=600,height=700')

      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup)
          setImportStatus(prev =>
            prev === 'connecting' || prev === 'importing' ? 'idle' : prev
          )
        }
      }, 500)
    } catch (err: any) {
      setImportStatus('error')
      setImportError(err.message || 'Failed to start import')
    }
  }, [user, session])

  // --- ICS upload handler ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user || !session?.access_token) return

    setFileUploadStatus('uploading')
    try {
      const result = await uploadICSFile(user, session.access_token, file)

      if (result.success) {
        setFileUploadStatus('success')
        setUploadedFileEventCount(result.eventCount || 0)
        dispatch({
          type: 'SET_CALENDAR_IMPORT_STATUS',
          status: 'success',
          eventCount: result.eventCount || 0,
        })
      } else {
        setFileUploadStatus('error')
      }
    } catch {
      setFileUploadStatus('error')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 600,
        color: colors.textPrimary,
        marginBottom: '8px',
        textAlign: 'center',
      }}>
        Your calendars
      </h2>
      <p style={{
        fontSize: '14px',
        color: colors.textSecondary,
        marginBottom: '32px',
        textAlign: 'center',
      }}>
        Bring your Google Calendar events into Glyde.
      </p>

      {/* Mode selector: Sync vs Import */}
      <div style={{
        display: 'flex',
        borderRadius: '10px',
        overflow: 'hidden',
        border: `1px solid ${colors.border}`,
        marginBottom: '24px',
      }}>
        <ModeTab
          label="Sync"
          description="Ongoing two-way sync"
          active={calendarMode === 'sync'}
          onClick={() => setCalendarMode('sync')}
          colors={colors}
        />
        <ModeTab
          label="Import"
          description="One-time event import"
          active={calendarMode === 'import'}
          onClick={() => setCalendarMode('import')}
          colors={colors}
        />
      </div>

      {/* Sync flow */}
      {calendarMode === 'sync' && (
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          backgroundColor: isDarkMode ? '#1e3a5f' : '#eff6ff',
          border: `1px solid ${isDarkMode ? '#2563eb' : '#bfdbfe'}`,
          marginBottom: '24px',
        }}>
          {connectStatus === 'idle' && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <GoogleIcon />
                <div>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: colors.textPrimary,
                  }}>
                    Google Calendar
                  </p>
                  <p style={{
                    fontSize: '13px',
                    color: colors.textSecondary,
                  }}>
                    Choose which calendars to keep in sync with Glyde
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConnectGoogle}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                Connect Google Calendar
              </button>
            </>
          )}

          {(connectStatus === 'connecting' || connectStatus === 'polling') && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: colors.textSecondary,
            }}>
              <Spinner />
              <span>
                {connectStatus === 'connecting' ? 'Connecting...' : 'Loading your calendars...'}
              </span>
            </div>
          )}

          {connectStatus === 'error' && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#ef4444',
                marginBottom: '12px',
              }}>
                <ErrorIcon />
                <span>{connectError || 'Connection failed'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConnectStatus('idle')
                  setConnectError(null)
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          )}

          {connectStatus === 'connected' && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#10b981',
                marginBottom: '16px',
              }}>
                <CheckIcon />
                <span>Google Calendar connected</span>
              </div>

              <GoogleCalendarPicker loading={mappingsLoading} />
            </div>
          )}
        </div>
      )}

      {/* Import flow */}
      {calendarMode === 'import' && (
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          backgroundColor: isDarkMode ? '#1e3a5f' : '#eff6ff',
          border: `1px solid ${isDarkMode ? '#2563eb' : '#bfdbfe'}`,
          marginBottom: '24px',
        }}>
          {importStatus === 'idle' && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <GoogleIcon />
                <div>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: colors.textPrimary,
                  }}>
                    Google Calendar
                  </p>
                  <p style={{
                    fontSize: '13px',
                    color: colors.textSecondary,
                  }}>
                    Import all your events once. No ongoing connection.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleImportGoogle}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                Import from Google Calendar
              </button>
            </>
          )}

          {(importStatus === 'connecting' || importStatus === 'importing') && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: colors.textSecondary,
            }}>
              <Spinner />
              <span>
                {importStatus === 'connecting' ? 'Connecting...' : 'Importing your events...'}
              </span>
            </div>
          )}

          {importStatus === 'error' && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#ef4444',
                marginBottom: '12px',
              }}>
                <ErrorIcon />
                <span>{importError || 'Import failed'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImportStatus('idle')
                  setImportError(null)
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          )}

          {importStatus === 'success' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#10b981',
            }}>
              <CheckIcon />
              <span>Imported {importedEventCount} events!</span>
            </div>
          )}
        </div>
      )}

      {/* ICS File Upload Section */}
      <div style={{
        padding: '20px',
        borderRadius: '12px',
        backgroundColor: colors.bgSecondary,
        border: `1px solid ${colors.border}`,
        marginBottom: '24px',
      }}>
        <p style={{
          fontSize: '14px',
          fontWeight: 500,
          color: colors.textPrimary,
          marginBottom: '12px',
        }}>
          Or upload a calendar file
        </p>
        <p style={{
          fontSize: '13px',
          color: colors.textSecondary,
          marginBottom: '16px',
        }}>
          Export your calendar as an .ics file and upload it here.
        </p>

        <input
          type="file"
          ref={fileInputRef}
          accept=".ics,text/calendar"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        {fileUploadStatus === 'idle' && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary,
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload .ics file
          </button>
        )}

        {fileUploadStatus === 'uploading' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: colors.textSecondary,
          }}>
            <Spinner />
            <span>Uploading and importing events...</span>
          </div>
        )}

        {fileUploadStatus === 'success' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#10b981',
          }}>
            <CheckIcon />
            <span>Imported {uploadedFileEventCount} events!</span>
          </div>
        )}

        {fileUploadStatus === 'error' && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#ef4444',
              marginBottom: '12px',
            }}>
              <ErrorIcon />
              <span>Upload failed. Please try again.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFileUploadStatus('idle')
                fileInputRef.current?.click()
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <p style={{
        fontSize: '12px',
        color: colors.textTertiary,
        textAlign: 'center',
      }}>
        You can always connect or import calendars later from your settings.
      </p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// --- Small helper components ---

function ModeTab({ label, description, active, onClick, colors }: {
  label: string
  description: string
  active: boolean
  onClick: () => void
  colors: ReturnType<typeof getColors>
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 16px',
        border: 'none',
        backgroundColor: active ? '#3b82f6' : colors.bgSecondary,
        color: active ? '#ffffff' : colors.textSecondary,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'background-color 0.15s',
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '11px', marginTop: '2px', opacity: active ? 0.85 : 0.7 }}>
        {description}
      </div>
    </button>
  )
}

function Spinner() {
  return (
    <div style={{
      width: '20px',
      height: '20px',
      border: '2px solid #3b82f6',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }} />
  )
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 10 11 15 8 12" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
