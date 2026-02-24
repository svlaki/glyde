import { useTheme } from '../lib/themeContext'
import type { Aspect } from '../lib/aspectService'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontWeight, fontSize, lineHeight } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'

interface AspectCardProps {
  aspect: Aspect
  isSelected: boolean
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function AspectCard({ aspect, isSelected, onClick, onEdit, onDelete }: AspectCardProps) {
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)

  const aspectColor = aspect.color || '#999'
  const isShared = aspect.visibility === 'shared'
  const isSharedWithMe = aspect.member_role && aspect.member_role !== 'owner'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px',
        background: isSelected
          ? hexToRgba(aspectColor, 0.22)
          : hexToRgba(aspectColor, 0.12),
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderLeft: `4px solid ${aspectColor}`,
        boxShadow: isSelected
          ? `0 4px 16px ${hexToRgba(aspectColor, 0.25)}, 0 0 0 1px ${hexToRgba(aspectColor, 0.15)}`
          : 'none'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = hexToRgba(aspectColor, 0.18)
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = hexToRgba(aspectColor, 0.12)
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: aspect.description ? '8px' : '0' }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: aspect.description ? '2px' : '0'
          }}>
            <span style={{
              ...typography.labelLg,
              fontWeight: fontWeight.semibold,
              color: colors.textPrimary,
            }}>
              {aspect.name}
            </span>
            {isSharedWithMe && (
              <span
                title={aspect.member_role === 'editor' ? 'Shared - Editor' : 'Shared - Viewer'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: hexToRgba(colors.accent, 0.12),
                  color: colors.accent,
                  fontSize: '10px',
                  fontWeight: 500,
                  flexShrink: 0
                }}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.5 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM15 3a3 3 0 1 0-5.878.87L6.467 5.54a3 3 0 1 0 0 4.92l2.655 1.67A3 3 0 1 0 12 13.5a3 3 0 0 0-.645-1.87l-2.655-1.67a3.01 3.01 0 0 0 0-.92l2.655-1.67A3 3 0 0 0 15 3zM4.5 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm8 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                </svg>
                {aspect.member_role === 'editor' ? 'Editor' : 'Viewer'}
              </span>
            )}
            {isShared && !isSharedWithMe && (
              <span
                title="Shared with others"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  background: hexToRgba(colors.accent, 0.12),
                  color: colors.accent,
                  fontSize: '11px',
                  flexShrink: 0
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.5 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM15 3a3 3 0 1 0-5.878.87L6.467 5.54a3 3 0 1 0 0 4.92l2.655 1.67A3 3 0 1 0 12 13.5a3 3 0 0 0-.645-1.87l-2.655-1.67a3.01 3.01 0 0 0 0-.92l2.655-1.67A3 3 0 0 0 15 3zM4.5 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm8 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                </svg>
              </span>
            )}
          </div>
          {aspect.description && (
            <div style={{
              ...typography.bodySm,
              color: colors.textSecondary,
              lineHeight: lineHeight.tight
            }}>
              {aspect.description}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
