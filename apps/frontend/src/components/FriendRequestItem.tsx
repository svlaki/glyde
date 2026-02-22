import { getColors } from '../styles/colors'
import { getTypography, fontWeight } from '../styles/typography'
import type { FriendRequest } from '../lib/friendshipService'

interface FriendRequestItemProps {
  request: FriendRequest
  isMobile?: boolean
  colors: ReturnType<typeof getColors>
  typography: ReturnType<typeof getTypography>
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  onBlock: (id: string) => void
}

export function FriendRequestItem({
  request,
  isMobile = false,
  colors,
  typography,
  onAccept,
  onDecline,
  onBlock
}: FriendRequestItemProps) {
  const buttonBase = {
    flex: 1,
    padding: isMobile ? '10px 10px' : '6px 10px',
    ...typography.labelSm,
    fontWeight: 500,
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    minHeight: isMobile ? '44px' : 'auto'
  } as const

  return (
    <div
      style={{
        padding: isMobile ? '14px' : '12px',
        background: colors.bgSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        transition: 'all 0.15s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = colors.bgHover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = colors.bgSecondary
      }}
    >
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          ...typography.labelLg,
          fontWeight: fontWeight.semibold,
          color: colors.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {request.requester_display_name}
        </div>
        <div style={{
          ...typography.bodySm,
          color: colors.textSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {request.requester_email}
        </div>
      </div>
      <div style={{
        display: 'flex',
        gap: '6px'
      }}>
        <button
          onClick={() => onAccept(request.id)}
          style={{
            ...buttonBase,
            background: '#2e7d32',
            color: 'white',
            border: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1b5e20'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#2e7d32'
          }}
        >
          Accept
        </button>
        <button
          onClick={() => onDecline(request.id)}
          style={{
            ...buttonBase,
            background: colors.bgTertiary,
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.bgHover
            e.currentTarget.style.color = colors.textPrimary
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.bgTertiary
            e.currentTarget.style.color = colors.textSecondary
          }}
        >
          Decline
        </button>
        <button
          onClick={() => onBlock(request.id)}
          style={{
            ...buttonBase,
            background: 'transparent',
            color: '#d32f2f',
            border: '1px solid #d32f2f'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#d32f2f'
            e.currentTarget.style.color = 'white'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#d32f2f'
          }}
          title="Block this user"
        >
          Block
        </button>
      </div>
    </div>
  )
}
