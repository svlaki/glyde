import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { getColors, hexToRgba } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import { Modal } from './Modal'
import type { Aspect } from '../lib/aspectService'
import { updateUserAspect } from '../lib/aspectService'
import {
  getAspectMembers,
  addMember,
  removeMember,
  updateMemberRole,
} from '../lib/sharedAspectService'
import type { SharedAspectMember } from '../lib/sharedAspectService'
import { getFriends } from '../lib/friendshipService'
import type { Friend } from '../lib/friendshipService'

interface AspectShareModalProps {
  aspect: Aspect | null
  isOpen: boolean
  onClose: () => void
  onAspectUpdated: () => void
}

export function AspectShareModal({ aspect, isOpen, onClose, onAspectUpdated }: AspectShareModalProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const accessToken = session?.access_token

  const [members, setMembers] = useState<SharedAspectMember[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'editor' | 'viewer'>('viewer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isShared = aspect?.visibility === 'shared'
  const isOwner = aspect?.user_id === user?.id

  useEffect(() => {
    if (isOpen && aspect && accessToken) {
      loadFriends()
      if (isShared) {
        loadMembers()
      }
    }
  }, [isOpen, aspect?.id, isShared])

  async function loadFriends() {
    if (!accessToken) return
    const response = await getFriends(accessToken)
    if (response.success && response.data) {
      setFriends(response.data)
    }
  }

  async function loadMembers() {
    if (!accessToken || !aspect) return
    const response = await getAspectMembers(aspect.id, accessToken)
    if (response.success && response.data) {
      setMembers(response.data)
    }
  }

  async function handleEnableSharing() {
    if (!user || !session || !aspect) return
    setLoading(true)
    setError(null)

    try {
      const result = await updateUserAspect(user, aspect.id, { visibility: 'shared' } as any, session.access_token)
      if (result.error) {
        setError(result.error)
      } else {
        onAspectUpdated()
        loadMembers()
      }
    } catch (err) {
      setError('Failed to enable sharing')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisableSharing() {
    if (!user || !session || !aspect) return
    if (!confirm('This will remove all members. Continue?')) return

    setLoading(true)
    setError(null)

    try {
      const result = await updateUserAspect(user, aspect.id, { visibility: 'private' } as any, session.access_token)
      if (result.error) {
        setError(result.error)
      } else {
        setMembers([])
        onAspectUpdated()
      }
    } catch (err) {
      setError('Failed to disable sharing')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!aspect || !selectedFriendId || !accessToken) return

    setLoading(true)
    setError(null)

    const response = await addMember(aspect.id, selectedFriendId, selectedRole, accessToken)
    if (response.success) {
      setSelectedFriendId('')
      loadMembers()
    } else {
      setError(response.error || 'Failed to add member')
    }

    setLoading(false)
  }

  async function handleRemoveMember(memberId: string) {
    if (!aspect || !accessToken) return
    if (!confirm('Remove this member?')) return

    const response = await removeMember(aspect.id, memberId, accessToken)
    if (response.success) {
      loadMembers()
    } else {
      setError(response.error || 'Failed to remove member')
    }
  }

  async function handleUpdateRole(memberId: string, newRole: 'editor' | 'viewer') {
    if (!aspect || !accessToken) return

    const response = await updateMemberRole(aspect.id, memberId, newRole, accessToken)
    if (response.success) {
      loadMembers()
    } else {
      setError(response.error || 'Failed to update role')
    }
  }

  if (!aspect) return null

  const inputStyle = {
    padding: '8px 12px',
    fontSize: fontSize.sm,
    background: colors.bgPrimary,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    outline: 'none'
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share "${aspect.name}"`}
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

        {/* Sharing toggle */}
        {!isShared ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: '16px' }}>
              This aspect is private. Enable sharing to invite friends.
            </p>
            <button
              onClick={handleEnableSharing}
              disabled={loading}
              style={{
                padding: '10px 20px',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                background: colors.accent,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Enabling...' : 'Enable Sharing'}
            </button>
          </div>
        ) : (
          <>
            {/* Add member form */}
            {isOwner && (
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={selectedFriendId}
                    onChange={(e) => setSelectedFriendId(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    disabled={loading}
                  >
                    <option value="">Select friend...</option>
                    {friends
                      .filter(f => !members.find(m => m.user_id === f.friend_id))
                      .map((friend) => (
                        <option key={friend.friend_id} value={friend.friend_id}>
                          {friend.friend_display_name}
                        </option>
                      ))}
                  </select>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as 'editor' | 'viewer')}
                    style={{ ...inputStyle, width: '100px' }}
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
                      opacity: loading || !selectedFriendId ? 0.5 : 1
                    }}
                  >
                    Add
                  </button>
                </div>
              </form>
            )}

            {/* Members list */}
            <div>
              <div style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.textSecondary,
                marginBottom: '10px'
              }}>
                Members ({members.length})
              </div>
              {members.length === 0 ? (
                <p style={{ color: colors.textTertiary, fontSize: fontSize.sm }}>
                  No members yet. Add friends above.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {members.map((member) => (
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
                          color: colors.textSecondary
                        }}>
                          {member.user?.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textPrimary }}>
                            {member.user?.display_name || 'Unknown'}
                            {member.role === 'owner' && (
                              <span style={{
                                marginLeft: '6px',
                                fontSize: fontSize.xs,
                                fontWeight: fontWeight.semibold,
                                color: colors.accent,
                                background: hexToRgba(colors.accent, 0.12),
                                padding: '1px 6px',
                                borderRadius: '8px'
                              }}>
                                Owner
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: fontSize.xs, color: colors.textTertiary }}>
                            {member.user?.email}
                          </div>
                        </div>
                      </div>
                      {isOwner && member.role !== 'owner' && (
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stop sharing button */}
            {isOwner && (
              <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '16px' }}>
                <button
                  onClick={handleDisableSharing}
                  disabled={loading}
                  style={{
                    padding: '8px 14px',
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    color: colors.error,
                    background: 'transparent',
                    border: `1px solid ${colors.error}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  Stop Sharing
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
