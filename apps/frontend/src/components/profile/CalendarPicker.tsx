import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'
import type { CalendarMapping } from '../../lib/connectionService'

interface CalendarPickerProps {
  mappings: CalendarMapping[]
  onToggleSync: (mapping: CalendarMapping) => void
  loading?: boolean
}

export function CalendarPicker({ mappings, onToggleSync, loading }: CalendarPickerProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 0',
        color: colors.textSecondary,
        fontSize: '13px',
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          border: '2px solid #3b82f6',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span>Loading calendars...</span>
      </div>
    )
  }

  if (mappings.length === 0) {
    return (
      <div style={{
        padding: '12px 0',
        color: colors.textTertiary,
        fontSize: '13px',
      }}>
        No calendars found.
      </div>
    )
  }

  const sortedMappings = [...mappings].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    const nameA = a.google_calendar_name || ''
    const nameB = b.google_calendar_name || ''
    return nameA.localeCompare(nameB)
  })

  const syncedCount = mappings.filter(m => m.is_synced).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {sortedMappings.map(mapping => {
        const calColor = mapping.google_calendar_color || '#3b82f6'
        return (
          <button
            key={mapping.id}
            type="button"
            onClick={() => onToggleSync(mapping)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              border: `1px solid ${mapping.is_synced ? '#3b82f6' : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}`,
              backgroundColor: mapping.is_synced
                ? (isDarkMode ? '#1e3a5f' : '#eff6ff')
                : 'transparent',
              color: colors.textPrimary,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: calColor,
              flexShrink: 0,
            }} />

            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {mapping.google_calendar_name || 'Unnamed Calendar'}
              </span>
              {mapping.is_primary && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#3b82f6',
                  backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  flexShrink: 0,
                }}>
                  Primary
                </span>
              )}
            </div>

            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '3px',
              border: `2px solid ${mapping.is_synced ? '#3b82f6' : (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)')}`,
              backgroundColor: mapping.is_synced ? '#3b82f6' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}>
              {mapping.is_synced && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </button>
        )
      })}

      <div style={{
        fontSize: '11px',
        color: colors.textTertiary,
        marginTop: '2px',
        paddingLeft: '2px',
      }}>
        {syncedCount} of {mappings.length} calendars synced
      </div>
    </div>
  )
}
