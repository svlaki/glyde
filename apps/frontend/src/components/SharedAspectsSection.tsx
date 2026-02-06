import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontFamily, fontSize, fontWeight } from '../styles/typography'
import {
  createSharedAspect,
  getUserSharedAspects,
  getAspectMembers,
  addMember,
  removeMember,
  updateMemberRole,
  deleteSharedAspect,
} from '../lib/sharedAspectService'
import type { SharedAspect, SharedAspectMember } from '../lib/sharedAspectService'
import { getFriends } from '../lib/friendshipService'
import type { Friend } from '../lib/friendshipService'

export function SharedAspectsSection() {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const typography = getTypography(false)

  const [aspects, setAspects] = useState<SharedAspect[]>([])
  const [selectedAspectId, setSelectedAspectId] = useState<string | null>(null)
  const [members, setMembers] = useState<SharedAspectMember[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [newAspectName, setNewAspectName] = useState('')
  const [newAspectColor, setNewAspectColor] = useState('#3b82f6')
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'editor' | 'viewer'>('viewer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accessToken = session?.access_token

  // Load aspects and friends
  useEffect(() => {
    if (user && accessToken) {
      loadAspects()
      loadFriends()
    }
  }, [user, accessToken])

  // Load members when aspect is selected
  useEffect(() => {
    if (selectedAspectId && accessToken) {
      loadMembers(selectedAspectId)
    }
  }, [selectedAspectId, accessToken])

  async function loadAspects() {
    if (!accessToken) return
    const response = await getUserSharedAspects(accessToken)
    if (response.success && response.data) {
      setAspects(response.data)
      if (response.data.length > 0 && !selectedAspectId) {
        setSelectedAspectId(response.data[0].id)
      }
    }
  }

  async function loadFriends() {
    if (!accessToken) return
    const response = await getFriends(accessToken)
    if (response.success && response.data) {
      setFriends(response.data)
    }
  }

  async function loadMembers(aspectId: string) {
    if (!accessToken) return
    const response = await getAspectMembers(aspectId, accessToken)
    if (response.success && response.data) {
      setMembers(response.data)
    }
  }

  async function handleCreateAspect(e: React.FormEvent) {
    e.preventDefault()
    if (!newAspectName.trim() || !accessToken) {
      setError('Aspect name is required')
      return
    }

    setLoading(true)
    setError(null)

    const response = await createSharedAspect(newAspectName, accessToken, undefined, newAspectColor)
    if (response.success) {
      setNewAspectName('')
      loadAspects()
    } else {
      setError(response.error || 'Failed to create aspect')
    }

    setLoading(false)
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAspectId || !selectedFriendId || !accessToken) {
      setError('Please select a friend')
      return
    }

    setLoading(true)
    setError(null)

    const response = await addMember(selectedAspectId, selectedFriendId, selectedRole, accessToken)
    if (response.success) {
      setSelectedFriendId('')
      loadMembers(selectedAspectId)
    } else {
      setError(response.error || 'Failed to add member')
    }

    setLoading(false)
  }

  async function handleRemoveMember(memberId: string) {
    if (!selectedAspectId || !accessToken) return
    if (!confirm('Remove this member?')) return

    const response = await removeMember(selectedAspectId, memberId, accessToken)
    if (response.success) {
      loadMembers(selectedAspectId)
    } else {
      setError(response.error || 'Failed to remove member')
    }
  }

  async function handleUpdateMemberRole(memberId: string, newRole: 'editor' | 'viewer') {
    if (!selectedAspectId || !accessToken) return

    const response = await updateMemberRole(selectedAspectId, memberId, newRole, accessToken)
    if (response.success) {
      loadMembers(selectedAspectId)
    } else {
      setError(response.error || 'Failed to update role')
    }
  }

  async function handleDeleteAspect(aspectId: string) {
    if (!accessToken) return
    if (!confirm('Delete this aspect? This cannot be undone.')) return

    const response = await deleteSharedAspect(aspectId, accessToken)
    if (response.success) {
      setSelectedAspectId(null)
      loadAspects()
    } else {
      setError(response.error || 'Failed to delete aspect')
    }
  }

  const currentAspect = aspects.find(a => a.id === selectedAspectId)
  const isOwner = currentAspect?.owner_id === user?.id
  const userRole = members.find(m => m.user_id === user?.id)?.role
  const canAddMembers = isOwner || userRole === 'editor'

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    fontSize: fontSize.base,
    fontFamily: fontFamily.sans,
    background: colors.bgTertiary,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    outline: 'none'
  }

  const buttonStyle = {
    padding: '10px 16px',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.sans,
    fontWeight: fontWeight.medium,
    background: colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'opacity 0.15s'
  }

  return (
    <div style={{ background: colors.bgSecondary, borderRadius: '12px', padding: '24px' }}>
      <h2 style={{ ...typography.headingLg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: '24px' }}>
        Shared Aspects
      </h2>

      {error && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: hexToRgba(colors.error, 0.1),
          border: `1px solid ${hexToRgba(colors.error, 0.3)}`,
          borderRadius: '8px',
          color: colors.error,
          fontSize: fontSize.sm
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Aspects List */}
        <div>
          <h3 style={{ ...typography.labelLg, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: '16px' }}>
            Your Aspects
          </h3>

          {/* Create new aspect form */}
          <form onSubmit={handleCreateAspect} style={{
            marginBottom: '20px',
            padding: '16px',
            background: colors.bgTertiary,
            borderRadius: '10px'
          }}>
            <input
              type="text"
              placeholder="New aspect name"
              value={newAspectName}
              onChange={(e) => setNewAspectName(e.target.value)}
              style={{ ...inputStyle, marginBottom: '10px' }}
              disabled={loading}
            />
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input
                type="color"
                value={newAspectColor}
                onChange={(e) => setNewAspectColor(e.target.value)}
                style={{
                  width: '44px',
                  height: '44px',
                  padding: '2px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer'
                }}
              />
              <span style={{ ...typography.bodySm, color: colors.textTertiary, alignSelf: 'center' }}>
                Pick a color
              </span>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ ...buttonStyle, width: '100%', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Creating...' : 'Create Aspect'}
            </button>
          </form>

          {/* Aspects list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aspects.length === 0 ? (
              <p style={{ ...typography.bodySm, color: colors.textTertiary }}>
                No shared aspects yet. Create one to share calendars with friends.
              </p>
            ) : (
              aspects.map((aspect) => (
                <button
                  key={aspect.id}
                  onClick={() => setSelectedAspectId(aspect.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: selectedAspectId === aspect.id ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                    background: selectedAspectId === aspect.id ? hexToRgba(colors.primary, 0.08) : colors.bgTertiary,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: aspect.color || '#3b82f6'
                    }} />
                    <div>
                      <div style={{ ...typography.bodyBase, fontWeight: fontWeight.medium, color: colors.textPrimary }}>
                        {aspect.name}
                      </div>
                      <div style={{ ...typography.bodySm, color: colors.textTertiary }}>
                        {aspect.owner_id === user?.id ? 'Owner' : 'Member'}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Aspect Details and Members */}
        {currentAspect ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: currentAspect.color || '#3b82f6'
                }} />
                <div>
                  <h3 style={{ ...typography.headingMd, fontWeight: fontWeight.semibold, color: colors.textPrimary }}>
                    {currentAspect.name}
                  </h3>
                  {currentAspect.description && (
                    <p style={{ ...typography.bodySm, color: colors.textSecondary, marginTop: '4px' }}>
                      {currentAspect.description}
                    </p>
                  )}
                </div>
              </div>
              {isOwner && (
                <button
                  onClick={() => handleDeleteAspect(currentAspect.id)}
                  style={{
                    padding: '8px 14px',
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    color: colors.error,
                    background: 'transparent',
                    border: `1px solid ${colors.error}`,
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              )}
            </div>

            {/* Add member form */}
            {canAddMembers && (
              <form onSubmit={handleAddMember} style={{
                marginBottom: '24px',
                padding: '16px',
                background: colors.bgTertiary,
                borderRadius: '10px'
              }}>
                <label style={{ ...typography.labelMd, fontWeight: fontWeight.medium, color: colors.textSecondary, display: 'block', marginBottom: '10px' }}>
                  Add Friend to Aspect
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    value={selectedFriendId}
                    onChange={(e) => setSelectedFriendId(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    disabled={loading}
                  >
                    <option value="">Select a friend...</option>
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
                    style={{ ...inputStyle, width: '120px' }}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="submit"
                    disabled={loading || !selectedFriendId}
                    style={{
                      ...buttonStyle,
                      background: '#10b981',
                      opacity: loading || !selectedFriendId ? 0.6 : 1
                    }}
                  >
                    Add
                  </button>
                </div>
                <p style={{ ...typography.bodySm, color: colors.textTertiary, marginTop: '8px' }}>
                  Editors can add events and members. Viewers can only see events.
                </p>
              </form>
            )}

            {/* Members list */}
            <div>
              <h4 style={{ ...typography.labelLg, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: '12px' }}>
                Members ({members.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {members.length === 0 ? (
                  <p style={{ ...typography.bodySm, color: colors.textTertiary }}>
                    No members yet. Add friends to share this aspect.
                  </p>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background: colors.bgTertiary,
                        borderRadius: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: colors.bgHover,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.semibold,
                          color: colors.textSecondary
                        }}>
                          {member.user?.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ ...typography.bodyBase, fontWeight: fontWeight.medium, color: colors.textPrimary }}>
                              {member.user?.display_name || 'Unknown'}
                            </span>
                            {member.role === 'owner' && (
                              <span style={{
                                fontSize: fontSize.xs,
                                fontWeight: fontWeight.semibold,
                                background: hexToRgba(colors.primary, 0.15),
                                color: colors.primary,
                                padding: '2px 8px',
                                borderRadius: '10px'
                              }}>
                                Owner
                              </span>
                            )}
                          </div>
                          <div style={{ ...typography.bodySm, color: colors.textTertiary }}>
                            {member.user?.email}
                          </div>
                        </div>
                      </div>
                      {isOwner && member.role !== 'owner' && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateMemberRole(member.id, e.target.value as 'editor' | 'viewer')}
                            style={{
                              padding: '6px 10px',
                              fontSize: fontSize.sm,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              background: colors.bgSecondary,
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
                              padding: '6px 12px',
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.medium,
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
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            color: colors.textTertiary,
            fontSize: fontSize.base
          }}>
            Select an aspect to view details
          </div>
        )}
      </div>
    </div>
  )
}
