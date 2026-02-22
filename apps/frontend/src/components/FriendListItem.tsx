import { getColors } from '../styles/colors'
import { getTypography, fontWeight } from '../styles/typography'
import type { Friend } from '../lib/friendshipService'

interface FriendListItemProps {
  friend: Friend
  isSelected: boolean
  isMobile?: boolean
  colors: ReturnType<typeof getColors>
  typography: ReturnType<typeof getTypography>
  onClick: () => void
}

export function FriendListItem({
  friend,
  isSelected,
  isMobile = false,
  colors,
  typography,
  onClick
}: FriendListItemProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: isMobile ? '14px' : '12px',
        background: isSelected ? colors.bgHover : colors.bgSecondary,
        border: `1px solid ${isSelected ? colors.textPrimary : colors.border}`,
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        minHeight: isMobile ? '56px' : 'auto'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = colors.bgHover
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = colors.bgSecondary
        }
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        {/* Avatar */}
        <div style={{
          width: isMobile ? '44px' : '40px',
          height: isMobile ? '44px' : '40px',
          borderRadius: '50%',
          background: colors.bgTertiary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden'
        }}>
          {friend.friend_avatar_url ? (
            <img
              src={friend.friend_avatar_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{
              ...typography.labelLg,
              fontWeight: 600,
              color: colors.textSecondary
            }}>
              {friend.friend_display_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            ...typography.labelLg,
            fontWeight: fontWeight.semibold,
            color: colors.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {friend.friend_display_name}
          </div>
          <div style={{
            ...typography.bodySm,
            color: colors.textSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {friend.friend_email}
          </div>
          {friend.aspects.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '4px',
              marginTop: '6px',
              flexWrap: 'wrap'
            }}>
              {friend.aspects.slice(0, 3).map(cat => (
                <span
                  key={cat.id}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: cat.color + '20',
                    color: cat.color,
                    ...typography.labelSm,
                    fontWeight: 500
                  }}
                >
                  {cat.name}
                </span>
              ))}
              {friend.aspects.length > 3 && (
                <span style={{
                  ...typography.labelSm,
                  color: colors.textSecondary
                }}>
                  +{friend.aspects.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
