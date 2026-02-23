import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/authContext'
import { useTheme } from '../../lib/themeContext'
import { usePlatform } from '../../hooks/usePlatform'
import { getColors, hexToRgba } from '../../styles/colors'
import { fontSize, fontWeight } from '../../styles/typography'
import { Modal } from '../Modal'
import {
  getEventMembers,
  addEventMember,
  removeEventMember,
  updateEventMemberRole,
} from '../../lib/sharedEventService'
import type { SharedEventMember } from '../../lib/sharedEventService'
import { getFriends } from '../../lib/friendshipService'
import type { Friend } from '../../lib/friendshipService'

interface EventShareModalProps {
  eventId: string | undefined
  eventTitle: string
  isOpen: boolean
  onClose: () => void
  onMembersChanged?: () => void
}

export function EventShareModal({
  eventId,
  eventTitle,
  isOpen,
  onClose,
  onMembersChanged
}: EventShareModalProps) {
  const { session } = useAuth()
  const { theme } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const accessToken = session?.access_token

  const [members, setMembers] = useState<SharedEventMember[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && accessToken) {
      loadFriends()
      if (eventId) {
        loadMembers()
      }
    }
  }, [isOpen, eventId])

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

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!eventId || !selectedFriendId || !accessToken) return

    setLoading(true)
    setError(null)

    const response = await addEventMember(eventId, selectedFriendId, selectedRole, accessToken)
    if (response.success) {
      setSelectedFriendId('')
      await loadMembers()
      onMembersChanged?.()
    } else {
      setError(response.error || 'Failed to add member')
    }

    setLoading(false)
  }

  async function handleRemoveMember(memberId: string) {
    if (!eventId || !accessToken) return
    if (!confirm('Remove this member?')) return

    const response = await removeEventMember(eventId, memberId, accessToken)
    if (response.success) {
      await loadMembers()
      onMembersChanged?.()
    } else {
      setError(response.error || 'Failed to remove member')
    }
  }

  async function handleUpdateRole(memberId: string, newRole: 'editor' | 'viewer') {
    if (!eventId || !accessToken) return

    const response = await updateEventMemberRole(eventId, memberId, newRole, accessToken)
    if (response.success) {
      await loadMembers()
    } else {
      setError(response.error || 'Failed to update role')
    }
  }

  const inputStyle = {
    padding: '8px 12px',
    fontSize: isMobile ? '16px' : fontSize.sm,
    background: colors.bgPrimary,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    outline: 'none',
    minHeight: isMobile ? '44px' : 'auto'
  }

  // Friends not already members
  const memberUserIds = new Set(members.map(m => m.user_id))
  const availableFriends = friends.filter(f => !memberUserIds.has(f.friend_id))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Invite to "${eventTitle || 'Event'}"`}
      maxWidth="480px"
    >
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {error && (
          <div style={{
            padding: '10px 14px',
            background: hexToRgba(colors.error, 0.1),
            border: `1px solid ${hexToRgba(colors.error, 0.3)}`,
            borderRadius: '6px',
            color: colors.error,
            fontSize: fontSize.sm
          }}>
            {error}
          </div>
        )}

        {!eventId ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
              Save the event first, then you can invite friends.
            </p>
          </div>
        ) : (
          <>
            {/* Add member form */}
            <form onSubmit={handleAddMember}>
              <label style={{
                display: 'block',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.textSecondary,
                marginBottom: '8px'
              }}>
                Add a friend
              </label>
              <div style={{ display: 'flex', gap: '8px', flexDirection: isMobile ? 'column' : 'row' }}>
                <select
                  value={selectedFriendId}
                  onChange={(e) => setSelectedFriendId(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  disabled={loading}
                >
                  <option value="">Select friend...</option>
                  {availableFriends.map((friend) => (
                    <option key={friend.friend_id} value={friend.friend_id}>
                      {friend.friend_display_name || friend.friend_email}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as 'editor' | 'viewer')}
                    style={{ ...inputStyle, width: isMobile ? undefined : '100px', flex: isMobile ? 1 : undefined }}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="submit"
                    disabled={loading || !selectedFriendId}
                    style={{
                      padding: '8px 14px',
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      background: colors.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      opacity: loading || !selectedFriendId ? 0.5 : 1,
                      minHeight: isMobile ? '44px' : 'auto'
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </form>

            {/* Members list */}
            <div>
              <div style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.textSecondary,
                marginBottom: '10px'
              }}>
                Members ({members.filter(m => m.role !== 'owner').length})
              </div>
              {members.filter(m => m.role !== 'owner').length === 0 ? (
                <p style={{ color: colors.textTertiary, fontSize: fontSize.sm }}>
                  No members yet. Add friends above.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {members
                    .filter(m => m.role !== 'owner')
                    .map((member) => (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: colors.bgSecondary,
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          background: colors.bgHover,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.semibold,
                          color: colors.textSecondary,
                          overflow: 'hidden'
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
                        <div>
                          <div style={{
                            fontSize: fontSize.sm,
                            fontWeight: fontWeight.medium,
                            color: colors.textPrimary
                          }}>
                            {member.user?.display_name || 'Unknown'}
                          </div>
                          <div style={{ fontSize: fontSize.xs, color: colors.textTertiary }}>
                            {member.user?.email}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.id, e.target.value as 'editor' | 'viewer')}
                          style={{
                            padding: '4px 8px',
                            fontSize: fontSize.xs,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '4px',
                            background: colors.bgPrimary,
                            color: colors.textPrimary,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          style={{
                            padding: '4px 8px',
                            fontSize: fontSize.xs,
                            color: colors.error,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
