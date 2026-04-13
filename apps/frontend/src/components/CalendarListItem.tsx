import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import type { CalendarMapping } from '../lib/connectionService'

interface CalendarListItemProps {
  mapping: CalendarMapping
  onToggleSync: (mappingId: string, isSynced: boolean) => void
  onSetAspect: (mappingId: string, aspectId: string | null) => void
  isUpdating?: boolean
}

export function CalendarListItem({
  mapping,
  onToggleSync,
  onSetAspect,
  isUpdating = false
}: CalendarListItemProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const { aspects } = useAspects()

  const selectedAspect = mapping.aspect_id
    ? aspects.find(a => a.id === mapping.aspect_id)
    : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      background: colors.bgSecondary,
      borderRadius: '6px',
      opacity: isUpdating ? 0.7 : 1,
      transition: 'opacity 0.2s'
    }}>
      {/* Sync Toggle */}
      <label style={{
        display: 'flex',
        alignItems: 'center',
        cursor: isUpdating ? 'not-allowed' : 'pointer'
      }}>
        <input
          type="checkbox"
          checked={mapping.is_synced}
          onChange={(e) => onToggleSync(mapping.id, e.target.checked)}
          disabled={isUpdating}
          style={{
            width: '16px',
            height: '16px',
            cursor: isUpdating ? 'not-allowed' : 'pointer',
            accentColor: '#4285f4'
          }}
        />
      </label>

      {/* Calendar Color Indicator */}
      <div style={{
        width: '12px',
        height: '12px',
        borderRadius: '3px',
        background: mapping.provider_calendar_color || '#4285f4',
        flexShrink: 0
      }} />

      {/* Calendar Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: fontSize.base,
          fontWeight: mapping.is_primary ? fontWeight.medium : fontWeight.normal,
          color: colors.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {mapping.provider_calendar_name || 'Untitled Calendar'}
          {mapping.is_primary && (
            <span style={{
              marginLeft: '8px',
              fontSize: fontSize.xs,
              color: colors.textTertiary,
              fontWeight: fontWeight.normal
            }}>
              Primary
            </span>
          )}
        </div>
      </div>

      {/* Aspect Selector */}
      <select
        value={mapping.aspect_id || ''}
        onChange={(e) => onSetAspect(mapping.id, e.target.value || null)}
        disabled={isUpdating || !mapping.is_synced}
        style={{
          padding: '6px 10px',
          fontSize: fontSize.sm,
          background: colors.bgTertiary,
          color: colors.textPrimary,
          border: `1px solid ${colors.border}`,
          borderRadius: '4px',
          cursor: isUpdating || !mapping.is_synced ? 'not-allowed' : 'pointer',
          minWidth: '120px',
          opacity: mapping.is_synced ? 1 : 0.5
        }}
      >
        <option value="">No aspect</option>
        {aspects.map(aspect => (
          <option key={aspect.id} value={aspect.id}>
            {aspect.name}
          </option>
        ))}
      </select>

      {/* Aspect Color Preview */}
      {selectedAspect && mapping.is_synced && (
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: selectedAspect.color || colors.textTertiary,
          flexShrink: 0
        }} />
      )}
    </div>
  )
}
