import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/authContext'
import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'
import { fontSize, fontWeight } from '../../styles/typography'
import {
  getEventMembers,
  addEventMember,
  removeEventMember,
  updateEventMemberRole,
} from '../../lib/sharedEventService'
import type { SharedEventMember } from '../../lib/sharedEventService'
import { getFriends } from '../../lib/friendshipService'
import type { Friend } from '../../lib/friendshipService'

interface EventMembersSectionProps {
  eventId?: string
  isOwner?: boolean
}

export function EventMembersSection({ eventId, isOwner = true }: EventMembersSectionProps) {
  const { user, session } = useAuth()
  const { theme } = useTheme()
  const colors = getColors(theme)
  const accessToken = session?.access_token

  const [members, setMembers] = useState<SharedEventMember[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'member' | 'viewer'>('member')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (accessToken) {
      loadFriends()
      if (eventId) {
        loadMembers()
      }
    }
  }, [eventId, accessToken])

  async function loadFriends() {
    if (!accessToken) return
    const response = await getFriends(accessToken)
    if (response.success && response.data) {
      setFriends(response.data)
    }
  }

  async function loadMembers() {
    if (!accessToken || !eventId) return
    const response = await getEventMembers(eventId, accessToken)
    if (response.success && response.data) {
      setMembers(response.data)
    }
  }

  async function handleAddMember() {
    if (!accessToken || !eventId || !selectedFriendId) return
    setLoading(true)
    setError(null)

    const result = await addEventMember(eventId, selectedFriendId, selectedRole, accessToken)
    if (result.success) {
      setSelectedFriendId('')
      await loadMembers()
    } else {
      setError(result.error || 'Failed to add member')
    }
    setLoading(false)
  }

  async function handleRemoveMember(memberId: string) {
    if (!accessToken || !eventId) return
    setLoading(true)
    const result = await removeEventMember(eventId, memberId, accessToken)
    if (result.success) {
      await loadMembers()
    }
    setLoading(false)
  }

  async function handleUpdateRole(memberId: string, role: 'member' | 'viewer') {
    if (!accessToken || !eventId) return
    const result = await updateEventMemberRole(eventId, memberId, role, accessToken)
    if (result.success) {
      await loadMembers()
    }
  }

  // Friends not already members
  const memberUserIds = new Set(members.map(m => m.user_id))
  const availableFriends = friends.filter(f => !memberUserIds.has(f.friend_id))

  if (!eventId) {
    return (
      <div style={{
        padding: '12px',
        background: colors.bgTertiary,
        borderRadius: '8px',
        fontSize: fontSize.sm,
        color: colors.textTertiary,
      }}>
        Save the event first, then you can invite friends.
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {/* Add member row */}
      {isOwner && availableFriends.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <select
            value={selectedFriendId}
            onChange={(e) => setSelectedFriendId(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 10px',
              fontSize: fontSize.sm,
              background: colors.bgPrimary,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
            }}
          >
            <option value="">Select a friend...</option>
            {availableFriends.map(f => (
              <option key={f.friend_id} value={f.friend_id}>
                {f.friend_display_name || f.friend_email}
              </option>
            ))}
          </select>

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as 'member' | 'viewer')}
            style={{
              padding: '8px 10px',
              fontSize: fontSize.sm,
              background: colors.bgPrimary,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              width: '90px',
            }}
          >
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>

          <button
            type="button"
            onClick={handleAddMember}
            disabled={!selectedFriendId || loading}
            style={{
              padding: '8px 14px',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              background: selectedFriendId ? colors.accent : colors.bgTertiary,
              color: selectedFriendId ? colors.bgPrimary : colors.textTertiary,
              border: 'none',
              borderRadius: '6px',
              cursor: selectedFriendId ? 'pointer' : 'not-allowed',
              opacity: loading ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            Invite
          </button>
        </div>
      )}

      {error && (
        <div style={{ fontSize: fontSize.sm, color: colors.error }}>
          {error}
        </div>
      )}

      {/* Member list */}
      {members.filter(m => m.role !== 'owner').length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {members
            .filter(m => m.role !== 'owner')
            .map(member => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  background: colors.bgTertiary,
                  borderRadius: '6px',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: colors.accent,
                  color: colors.bgPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: fontWeight.semibold,
                  flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  {member.user?.avatar_url ? (
                    <img
                      src={member.user.avatar_url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    (member.user?.display_name || member.user?.email || '?')[0].toUpperCase()
                  )}
                </div>

                {/* Name */}
                <span style={{
                  flex: 1,
                  fontSize: fontSize.sm,
                  color: colors.textPrimary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}>
                  {member.user?.display_name || member.user?.email || 'Unknown'}
                  {member.status === 'pending' && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: fontWeight.medium,
                      color: '#f59e0b',
                      background: 'rgba(245, 158, 11, 0.15)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      flexShrink: 0,
                    }}>
                      Pending
                    </span>
                  )}
                </span>

                {/* Role badge / selector */}
                {isOwner ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateRole(member.id, e.target.value as 'member' | 'viewer')}
                    style={{
                      padding: '2px 6px',
                      fontSize: '11px',
                      background: colors.bgPrimary,
                      color: colors.textSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '4px',
                    }}
                  >
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span style={{
                    fontSize: '11px',
                    color: colors.textTertiary,
                    textTransform: 'capitalize',
                  }}>
                    {member.role}
                  </span>
                )}

                {/* Remove button */}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.textTertiary,
                      cursor: 'pointer',
                      padding: '2px',
                      fontSize: '14px',
                      lineHeight: 1,
                    }}
                    title="Remove member"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      {members.filter(m => m.role !== 'owner').length === 0 && (
        <div style={{
          fontSize: fontSize.sm,
          color: colors.textTertiary,
          padding: '4px 0',
        }}>
          No members added yet. Invite friends above.
        </div>
      )}
    </div>
  )
}
