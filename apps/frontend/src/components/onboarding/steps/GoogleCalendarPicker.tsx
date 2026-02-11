import { useCallback } from 'react'
import { useDarkMode } from '../../../lib/darkModeContext'
import { getColors } from '../../../styles/colors'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '../../../lib/authContext'
import { updateCalendarMapping } from '../../../lib/connectionService'
import type { CalendarMapping } from '../../../lib/connectionService'

interface GoogleCalendarPickerProps {
  loading?: boolean
}

export function GoogleCalendarPicker({ loading }: GoogleCalendarPickerProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { state, dispatch } = useOnboarding()
  const { user, session } = useAuth()

  const handleToggleSync = useCallback(async (mapping: CalendarMapping) => {
    if (!user || !session?.access_token) return

    const newSynced = !mapping.is_synced

    // Optimistic update
    dispatch({ type: 'UPDATE_MAPPING_SYNC', mappingId: mapping.id, isSynced: newSynced })

    // Persist to backend
    const result = await updateCalendarMapping(
      user,
      mapping.id,
      { is_synced: newSynced },
      session.access_token
    )

    // Revert if failed
    if (result.error) {
      dispatch({ type: 'UPDATE_MAPPING_SYNC', mappingId: mapping.id, isSynced: mapping.is_synced })
    }
  }, [user, session, dispatch])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '20px',
        color: colors.textSecondary,
      }}>
        <div style={{
          width: '20px',
          height: '20px',
          border: '2px solid #3b82f6',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span>Loading your calendars...</span>
      </div>
    )
  }

  if (state.calendarMappings.length === 0) {
    return (
      <div style={{
        padding: '16px',
        color: colors.textSecondary,
        fontSize: '14px',
        textAlign: 'center',
      }}>
        No calendars found. Try reconnecting your Google account.
      </div>
    )
  }

  // Sort: primary first, then alphabetical
  const sortedMappings = [...state.calendarMappings].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    const nameA = a.google_calendar_name || ''
    const nameB = b.google_calendar_name || ''
    return nameA.localeCompare(nameB)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{
        display: 'block',
        marginBottom: '4px',
        fontSize: '14px',
        fontWeight: 500,
        color: colors.textPrimary,
      }}>
        Choose which calendars to sync
      </label>
      <p style={{
        fontSize: '13px',
        color: colors.textSecondary,
        marginBottom: '8px',
      }}>
        Events from synced calendars will appear in your Glyde calendar.
      </p>

      {sortedMappings.map(mapping => {
        const calColor = mapping.google_calendar_color || '#3b82f6'
        return (
          <button
            key={mapping.id}
            type="button"
            onClick={() => handleToggleSync(mapping)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              border: `1px solid ${mapping.is_synced ? '#3b82f6' : colors.border}`,
              backgroundColor: mapping.is_synced
                ? (isDarkMode ? '#1e3a5f' : '#eff6ff')
                : colors.bgSecondary,
              color: colors.textPrimary,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              width: '100%',
            }}
          >
            {/* Color dot */}
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: calColor,
              flexShrink: 0,
            }} />

            {/* Calendar name + primary badge */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {mapping.google_calendar_name || 'Unnamed Calendar'}
                </span>
                {mapping.is_primary && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#3b82f6',
                    backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}>
                    Primary
                  </span>
                )}
              </div>
            </div>

            {/* Sync toggle */}
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              border: `2px solid ${mapping.is_synced ? '#3b82f6' : colors.border}`,
              backgroundColor: mapping.is_synced ? '#3b82f6' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}>
              {mapping.is_synced && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </button>
        )
      })}

      <p style={{
        fontSize: '12px',
        color: colors.textTertiary,
        marginTop: '4px',
      }}>
        {state.calendarMappings.filter(m => m.is_synced).length} of {state.calendarMappings.length} calendars selected
      </p>
    </div>
  )
}
