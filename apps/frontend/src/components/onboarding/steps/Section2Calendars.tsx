import { useState } from 'react'
import { useDarkMode } from '../../../lib/darkModeContext'
import { getColors } from '../../../styles/colors'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '../../../lib/authContext'
import { CALENDAR_OPTIONS } from '../../../lib/onboardingService'
import { getGoogleAuthUrl, getMicrosoftAuthUrl } from '../../../lib/calendarService'

export function Section2Calendars() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { state, toggleCalendar, updateField, dispatch } = useOnboarding()
  const { user, session } = useAuth()
  const [importLoading, setImportLoading] = useState(false)

  const hasImportableCalendar = state.selectedCalendars.some(c => {
    const option = CALENDAR_OPTIONS.find(opt => opt.id === c)
    return option?.importable === true
  })
  const hasOtherSelected = state.selectedCalendars.includes('other')

  const handleStartImport = async () => {
    if (!user || !session?.access_token) return

    setImportLoading(true)
    dispatch({ type: 'SET_CALENDAR_IMPORT_STATUS', status: 'importing' })

    try {
      // Determine which calendar to import
      const calendarType = state.selectedCalendars.includes('google') ? 'google' : 'outlook'

      // Get auth URL
      const result = calendarType === 'google'
        ? await getGoogleAuthUrl(user, session.access_token)
        : await getMicrosoftAuthUrl(user, session.access_token)

      if (result.success && result.authUrl) {
        // Open OAuth in popup
        const popup = window.open(result.authUrl, 'calendar-oauth', 'width=600,height=700')

        // Set up message listener for OAuth callback
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'CALENDAR_IMPORT_SUCCESS') {
            dispatch({
              type: 'SET_CALENDAR_IMPORT_STATUS',
              status: 'success',
              eventCount: event.data.eventCount || 0
            })
            window.removeEventListener('message', handleMessage)
          } else if (event.data?.type === 'CALENDAR_IMPORT_ERROR') {
            dispatch({ type: 'SET_CALENDAR_IMPORT_STATUS', status: 'error' })
            window.removeEventListener('message', handleMessage)
          }
        }
        window.addEventListener('message', handleMessage)

        // Poll for popup close
        const checkPopup = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkPopup)
            setImportLoading(false)
          }
        }, 500)
      } else {
        dispatch({ type: 'SET_CALENDAR_IMPORT_STATUS', status: 'error' })
      }
    } catch (error) {
      console.error('Calendar import error:', error)
      dispatch({ type: 'SET_CALENDAR_IMPORT_STATUS', status: 'error' })
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 600,
        color: colors.textPrimary,
        marginBottom: '8px',
        textAlign: 'center'
      }}>
        Import your calendars
      </h2>
      <p style={{
        fontSize: '14px',
        color: colors.textSecondary,
        marginBottom: '32px',
        textAlign: 'center'
      }}>
        Connect your existing calendars to get started with all your events in one place.
      </p>

      {/* Calendar Selection */}
      <div style={{ marginBottom: '32px' }}>
        <label style={{
          display: 'block',
          marginBottom: '12px',
          fontSize: '14px',
          fontWeight: 500,
          color: colors.textPrimary
        }}>
          What calendars do you currently use? Select all that apply.
        </label>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {CALENDAR_OPTIONS.map(option => {
            const isSelected = state.selectedCalendars.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleCalendar(option.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${isSelected ? '#3b82f6' : colors.border}`,
                  backgroundColor: isSelected ? (isDarkMode ? '#1e3a5f' : '#eff6ff') : colors.bgSecondary,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: `2px solid ${isSelected ? '#3b82f6' : colors.border}`,
                  backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>

        {/* Other calendar text input */}
        {hasOtherSelected && (
          <div style={{ marginTop: '12px' }}>
            <input
              type="text"
              value={state.otherCalendar}
              onChange={(e) => updateField('otherCalendar', e.target.value)}
              placeholder="Please specify which calendar..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.bgSecondary,
                color: colors.textPrimary,
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        )}
      </div>

      {/* Import prompt */}
      {hasImportableCalendar && (
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          backgroundColor: isDarkMode ? '#1e3a5f' : '#eff6ff',
          border: `1px solid ${isDarkMode ? '#2563eb' : '#bfdbfe'}`,
          marginBottom: '24px'
        }}>
          <p style={{
            fontSize: '14px',
            fontWeight: 500,
            color: colors.textPrimary,
            marginBottom: '16px'
          }}>
            Would you like to import your existing calendar events?
          </p>

          {state.calendarImportStatus === 'idle' && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={handleStartImport}
                disabled={importLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: importLoading ? 'not-allowed' : 'pointer',
                  opacity: importLoading ? 0.7 : 1
                }}
              >
                {importLoading ? 'Starting...' : 'Yes, import'}
              </button>
              <button
                type="button"
                onClick={() => updateField('wantsToImport', false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.bgSecondary,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Skip for now
              </button>
            </div>
          )}

          {state.calendarImportStatus === 'importing' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: colors.textSecondary
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #3b82f6',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span>Importing your calendar...</span>
            </div>
          )}

          {state.calendarImportStatus === 'success' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#10b981'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="16 10 11 15 8 12" />
              </svg>
              <span>Imported {state.importedEventCount} events!</span>
            </div>
          )}

          {state.calendarImportStatus === 'error' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#ef4444'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>Import failed. You can try again from settings later.</span>
            </div>
          )}
        </div>
      )}

      <p style={{
        fontSize: '12px',
        color: colors.textTertiary,
        textAlign: 'center'
      }}>
        You can always import or connect calendars later from your settings.
      </p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
