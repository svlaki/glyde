import { useState } from 'react'
import { getColors } from '../styles/colors'
import { getTypography, fontWeight } from '../styles/typography'
import type { DiscoverUser } from '../lib/friendshipService'

interface DiscoverUserItemProps {
  user: DiscoverUser
  isMobile?: boolean
  colors: ReturnType<typeof getColors>
  typography: ReturnType<typeof getTypography>
  onAdd: (user: DiscoverUser) => Promise<void>
  onAccept: (user: DiscoverUser) => Promise<void>
}

export function DiscoverUserItem({
  user,
  isMobile = false,
  colors,
  typography,
  onAdd,
  onAccept
}: DiscoverUserItemProps) {
  const [actionLoading, setActionLoading] = useState(false)

  async function handleAdd() {
    setActionLoading(true)
    try {
      await onAdd(user)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAccept() {
    setActionLoading(true)
    try {
      await onAccept(user)
    } finally {
      setActionLoading(false)
    }
  }

  function renderActionButton() {
    const baseStyle = {
      padding: isMobile ? '8px 14px' : '6px 12px',
      ...typography.labelSm,
      fontWeight: 500,
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'all 0.15s',
      minHeight: isMobile ? '44px' : 'auto',
      flexShrink: 0,
    } as const

    if (user.relationship === 'none') {
      return (
        <button
          onClick={handleAdd}
          disabled={actionLoading}
          style={{
            ...baseStyle,
            background: colors.textPrimary,
            color: colors.bgPrimary,
            border: 'none',
            opacity: actionLoading ? 0.6 : 1,
            cursor: actionLoading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!actionLoading) {
              e.currentTarget.style.opacity = '0.85'
            }
          }}
          onMouseLeave={(e) => {
            if (!actionLoading) {
              e.currentTarget.style.opacity = '1'
            }
          }}
        >
          {actionLoading ? 'Sending...' : 'Add'}
        </button>
      )
    }

    if (user.relationship === 'pending_sent') {
      return (
        <span style={{
          ...baseStyle,
          background: colors.bgTertiary,
          color: colors.textSecondary,
          border: `1px solid ${colors.border}`,
          cursor: 'default',
          display: 'inline-flex',
          alignItems: 'center',
        }}>
          Pending
        </span>
      )
    }

    if (user.relationship === 'pending_received') {
      return (
        <button
          onClick={handleAccept}
          disabled={actionLoading}
          style={{
            ...baseStyle,
            background: '#2e7d32',
            color: 'white',
            border: 'none',
            opacity: actionLoading ? 0.6 : 1,
            cursor: actionLoading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!actionLoading) {
              e.currentTarget.style.background = '#1b5e20'
            }
          }}
          onMouseLeave={(e) => {
            if (!actionLoading) {
              e.currentTarget.style.background = '#2e7d32'
            }
          }}
        >
          {actionLoading ? 'Accepting...' : 'Accept'}
        </button>
      )
    }

    // 'friends'
    return (
      <span style={{
        ...baseStyle,
        background: 'transparent',
        color: colors.textSecondary,
        border: `1px solid ${colors.border}`,
        cursor: 'default',
        display: 'inline-flex',
        alignItems: 'center',
      }}>
        Friends
      </span>
    )
  }

  return (
    <div
      style={{
        padding: isMobile ? '14px' : '12px',
        background: colors.bgSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        transition: 'all 0.15s',
        minHeight: isMobile ? '56px' : 'auto',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = colors.bgHover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = colors.bgSecondary
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
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
          overflow: 'hidden',
        }}>
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{
              ...typography.labelLg,
              fontWeight: 600,
              color: colors.textSecondary,
            }}>
              {user.display_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          )}
        </div>

        {/* Name + email */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            ...typography.labelLg,
            fontWeight: fontWeight.semibold,
            color: colors.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user.display_name}
          </div>
          <div style={{
            ...typography.bodySm,
            color: colors.textSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user.email}
          </div>
        </div>

        {/* Action button */}
        {renderActionButton()}
      </div>
    </div>
  )
}
