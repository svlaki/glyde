import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  getPendingRequests,
  removeFriend,
  updateFriendNotes,
  addFriendAspect,
  removeFriendAspect,
} from '../lib/friendshipService'
import type { Friend, FriendRequest } from '../lib/friendshipService'
import { getColors } from '../styles/colors'
import { getTypography, fontWeight } from '../styles/typography'

export function FriendsSection() {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const { aspects } = useAspects()
  const colors = getColors(theme)
  const typography = getTypography(false)

  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [newFriendEmail, setNewFriendEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends')
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const accessToken = session?.access_token

  // Load friends and pending requests
  useEffect(() => {
    if (user && accessToken) {
      loadFriends()
      loadPendingRequests()
    }
  }, [user, accessToken])

  async function loadFriends() {
    if (!accessToken) return
    const response = await getFriends(accessToken)
    if (response.success && response.data) {
      setFriends(response.data)
      // Update selected friend if it exists in the new data
      if (selectedFriend) {
        const updated = response.data.find(f => f.friendship_id === selectedFriend.friendship_id)
        if (updated) {
          setSelectedFriend(updated)
          setNotesValue(updated.notes || '')
        }
      }
    }
  }

  async function loadPendingRequests() {
    if (!accessToken) return
    const response = await getPendingRequests(accessToken)
    if (response.success && response.data) {
      setPendingRequests(response.data)
    }
  }

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!newFriendEmail.trim() || !accessToken) {
      setError('Please enter a valid email')
      return
    }

    setLoading(true)
    setError(null)

    const response = await sendFriendRequest(newFriendEmail, accessToken)
    if (response.success) {
      setNewFriendEmail('')
      setError(null)
    } else {
      setError(response.error || 'Failed to send friend request')
    }

    setLoading(false)
  }

  async function handleAcceptRequest(friendshipId: string) {
    if (!accessToken) return

    const response = await acceptFriendRequest(friendshipId, accessToken)
    if (response.success) {
      setPendingRequests(pendingRequests.filter(r => r.id !== friendshipId))
      loadFriends()
      setError(null)
    } else {
      setError(response.error || 'Failed to accept request')
    }
  }

  async function handleDeclineRequest(friendshipId: string, block: boolean = false) {
    if (!accessToken) return

    const response = await declineFriendRequest(friendshipId, block, accessToken)
    if (response.success) {
      setPendingRequests(pendingRequests.filter(r => r.id !== friendshipId))
      setError(null)
    } else {
      setError(response.error || 'Failed to decline request')
    }
  }

  async function handleRemoveFriend(friendshipId: string) {
    if (!accessToken) return
    if (!confirm('Are you sure you want to remove this friend?')) return

    const response = await removeFriend(friendshipId, accessToken)
    if (response.success) {
      if (selectedFriend?.friendship_id === friendshipId) {
        setSelectedFriend(null)
      }
      loadFriends()
      setError(null)
    } else {
      setError(response.error || 'Failed to remove friend')
    }
  }

  function handleSelectFriend(friend: Friend) {
    setSelectedFriend(friend)
    setNotesValue(friend.notes || '')
    setEditingNotes(false)
  }

  async function handleSaveNotes() {
    if (!accessToken || !selectedFriend) return

    setSavingNotes(true)
    const response = await updateFriendNotes(selectedFriend.friendship_id, notesValue, accessToken)
    if (response.success) {
      setEditingNotes(false)
      loadFriends()
    } else {
      setError(response.error || 'Failed to save notes')
    }
    setSavingNotes(false)
  }

  async function handleAddAspect(aspectId: string) {
    if (!accessToken || !selectedFriend) return

    const response = await addFriendAspect(selectedFriend.friendship_id, aspectId, accessToken)
    if (response.success) {
      loadFriends()
    } else {
      setError(response.error || 'Failed to add aspect')
    }
  }

  async function handleRemoveAspect(aspectId: string) {
    if (!accessToken || !selectedFriend) return

    const response = await removeFriendAspect(selectedFriend.friendship_id, aspectId, accessToken)
    if (response.success) {
      loadFriends()
    } else {
      setError(response.error || 'Failed to remove aspect')
    }
  }

  // Get aspects not yet assigned to this friend
  const availableAspects = aspects.filter(
    asp => !selectedFriend?.aspects.some(fc => fc.id === asp.id)
  )

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary,
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 30px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bgPrimary
      }}>
        <h1 style={{
          ...typography.headingLg,
          fontWeight: 600,
          color: colors.textPrimary,
          margin: 0
        }}>
          Friends
        </h1>
        <p style={{
          ...typography.bodySm,
          color: colors.textSecondary,
          margin: '4px 0 0 0'
        }}>
          Manage your friend connections and requests
        </p>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex'
      }}>
        {/* Left Panel - Add Friend + Tabs */}
        <div style={{
          width: '360px',
          borderRight: `1px solid ${colors.border}`,
          background: colors.bgPrimary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Add Friend Form */}
          <div style={{
            padding: '20px',
            borderBottom: `1px solid ${colors.border}`,
            background: colors.bgPrimary
          }}>
            <form onSubmit={handleSendRequest}>
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <input
                  type="email"
                  placeholder="friend@example.com"
                  value={newFriendEmail}
                  onChange={(e) => setNewFriendEmail(e.target.value)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    ...typography.bodySm,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    background: colors.bgSecondary,
                    color: colors.textPrimary,
                    outline: 'none',
                    transition: 'all 0.15s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = colors.textPrimary
                    e.currentTarget.style.background = colors.bgPrimary
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.border
                    e.currentTarget.style.background = colors.bgSecondary
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    ...typography.labelLg,
                    fontWeight: 500,
                    background: colors.bgTertiary,
                    color: colors.textSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    opacity: loading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = colors.bgHover
                      e.currentTarget.style.color = colors.textPrimary
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = colors.bgTertiary
                      e.currentTarget.style.color = colors.textSecondary
                    }
                  }}
                >
                  {loading ? 'Sending...' : 'Add'}
                </button>
              </div>
              {error && (
                <div style={{
                  ...typography.bodySm,
                  color: '#d32f2f',
                  marginTop: '6px'
                }}>
                  {error}
                </div>
              )}
            </form>
          </div>

          {/* Tabs */}
          <div style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            gap: '16px',
            background: colors.bgPrimary
          }}>
            <button
              onClick={() => setActiveTab('friends')}
              style={{
                padding: '8px 0',
                ...typography.labelLg,
                fontWeight: activeTab === 'friends' ? 600 : 500,
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'friends' ? `2px solid ${colors.textPrimary}` : '2px solid transparent',
                color: activeTab === 'friends' ? colors.textPrimary : colors.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Friends ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              style={{
                padding: '8px 0',
                ...typography.labelLg,
                fontWeight: activeTab === 'requests' ? 600 : 500,
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'requests' ? `2px solid ${colors.textPrimary}` : '2px solid transparent',
                color: activeTab === 'requests' ? colors.textPrimary : colors.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative'
              }}
            >
              Requests
              {pendingRequests.length > 0 && (
                <span style={{
                  marginLeft: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '20px',
                  height: '20px',
                  background: '#d32f2f',
                  color: 'white',
                  borderRadius: '10px',
                  ...typography.labelSm,
                  fontWeight: 600
                }}>
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* List Container */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {activeTab === 'friends' && (
              <>
                {friends.length === 0 ? (
                  <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: colors.textSecondary,
                    ...typography.bodySm
                  }}>
                    No friends yet. Add one above!
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.friendship_id}
                      onClick={() => handleSelectFriend(friend)}
                      style={{
                        padding: '12px',
                        background: selectedFriend?.friendship_id === friend.friendship_id
                          ? colors.bgHover
                          : colors.bgSecondary,
                        border: `1px solid ${selectedFriend?.friendship_id === friend.friendship_id
                          ? colors.textPrimary
                          : colors.border}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedFriend?.friendship_id !== friend.friendship_id) {
                          e.currentTarget.style.background = colors.bgHover
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedFriend?.friendship_id !== friend.friendship_id) {
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
                          width: '40px',
                          height: '40px',
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
                  ))
                )}
              </>
            )}

            {activeTab === 'requests' && (
              <>
                {pendingRequests.length === 0 ? (
                  <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: colors.textSecondary,
                    ...typography.bodySm
                  }}>
                    No pending requests
                  </div>
                ) : (
                  pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      style={{
                        padding: '12px',
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
                      <div style={{
                        marginBottom: '8px'
                      }}>
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
                          onClick={() => handleAcceptRequest(request.id)}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            ...typography.labelSm,
                            fontWeight: 500,
                            background: '#2e7d32',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
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
                          onClick={() => handleDeclineRequest(request.id, false)}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            ...typography.labelSm,
                            fontWeight: 500,
                            background: colors.bgTertiary,
                            color: colors.textSecondary,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
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
                          onClick={() => handleDeclineRequest(request.id, true)}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            ...typography.labelSm,
                            fontWeight: 500,
                            background: 'transparent',
                            color: '#d32f2f',
                            border: `1px solid #d32f2f`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
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
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Panel - Friend Details */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '30px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {selectedFriend ? (
            <div style={{ maxWidth: '600px' }}>
              {/* Friend Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: colors.bgTertiary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden'
                }}>
                  {selectedFriend.friend_avatar_url ? (
                    <img
                      src={selectedFriend.friend_avatar_url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{
                      ...typography.headingMd,
                      fontWeight: 600,
                      color: colors.textSecondary
                    }}>
                      {selectedFriend.friend_display_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{
                    ...typography.headingMd,
                    fontWeight: 600,
                    color: colors.textPrimary,
                    margin: 0
                  }}>
                    {selectedFriend.friend_display_name}
                  </h2>
                  <div style={{
                    ...typography.bodySm,
                    color: colors.textSecondary,
                    marginTop: '4px'
                  }}>
                    {selectedFriend.friend_email}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFriend(selectedFriend.friendship_id)}
                  style={{
                    padding: '8px 16px',
                    ...typography.labelSm,
                    fontWeight: 500,
                    background: 'transparent',
                    color: '#d32f2f',
                    border: `1px solid #d32f2f`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#d32f2f'
                    e.currentTarget.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#d32f2f'
                  }}
                >
                  Remove Friend
                </button>
              </div>

              {/* Notes Section */}
              <div style={{
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <label style={{
                    ...typography.labelLg,
                    fontWeight: 600,
                    color: colors.textPrimary
                  }}>
                    Notes
                  </label>
                  {!editingNotes ? (
                    <button
                      onClick={() => setEditingNotes(true)}
                      style={{
                        padding: '4px 10px',
                        ...typography.labelSm,
                        fontWeight: 500,
                        background: colors.bgTertiary,
                        color: colors.textSecondary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
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
                      Edit
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        style={{
                          padding: '4px 10px',
                          ...typography.labelSm,
                          fontWeight: 500,
                          background: '#2e7d32',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: savingNotes ? 'not-allowed' : 'pointer',
                          opacity: savingNotes ? 0.6 : 1,
                          transition: 'all 0.15s'
                        }}
                      >
                        {savingNotes ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingNotes(false)
                          setNotesValue(selectedFriend.notes || '')
                        }}
                        style={{
                          padding: '4px 10px',
                          ...typography.labelSm,
                          fontWeight: 500,
                          background: colors.bgTertiary,
                          color: colors.textSecondary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                {editingNotes ? (
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Add notes about this friend (interests, how you know them, etc.)"
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      padding: '12px',
                      ...typography.bodySm,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      background: colors.bgSecondary,
                      color: colors.textPrimary,
                      resize: 'vertical',
                      outline: 'none',
                      transition: 'all 0.15s'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = colors.textPrimary
                      e.currentTarget.style.background = colors.bgPrimary
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = colors.border
                      e.currentTarget.style.background = colors.bgSecondary
                    }}
                  />
                ) : (
                  <div style={{
                    padding: '12px',
                    background: colors.bgSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    minHeight: '60px',
                    ...typography.bodySm,
                    color: selectedFriend.notes ? colors.textPrimary : colors.textSecondary,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {selectedFriend.notes || 'No notes yet. Click Edit to add notes about this friend.'}
                  </div>
                )}
              </div>

              {/* Aspects Section */}
              <div>
                <label style={{
                  ...typography.labelLg,
                  fontWeight: 600,
                  color: colors.textPrimary,
                  display: 'block',
                  marginBottom: '8px'
                }}>
                  Associated Aspects
                </label>
                <p style={{
                  ...typography.bodySm,
                  color: colors.textSecondary,
                  margin: '0 0 12px 0'
                }}>
                  Tag this friend with aspects they're involved in
                </p>

                {/* Current aspects */}
                {selectedFriend.aspects.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '12px'
                  }}>
                    {selectedFriend.aspects.map(cat => (
                      <div
                        key={cat.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: cat.color + '20',
                          border: `1px solid ${cat.color}40`
                        }}
                      >
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: cat.color
                        }} />
                        <span style={{
                          ...typography.labelSm,
                          fontWeight: 500,
                          color: colors.textPrimary
                        }}>
                          {cat.name}
                        </span>
                        <button
                          onClick={() => handleRemoveAspect(cat.id)}
                          style={{
                            padding: '0',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'transparent',
                            border: 'none',
                            color: colors.textSecondary,
                            cursor: 'pointer',
                            borderRadius: '50%',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = colors.bgTertiary
                            e.currentTarget.style.color = colors.textPrimary
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = colors.textSecondary
                          }}
                          title="Remove aspect"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add aspect dropdown */}
                {availableAspects.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddAspect(e.target.value)
                        e.target.value = ''
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      ...typography.bodySm,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      background: colors.bgSecondary,
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="">+ Add aspect...</option>
                    {availableAspects.map(asp => (
                      <option key={asp.id} value={asp.id}>
                        {asp.name}
                      </option>
                    ))}
                  </select>
                )}

                {availableAspects.length === 0 && selectedFriend.aspects.length > 0 && (
                  <div style={{
                    ...typography.bodySm,
                    color: colors.textSecondary,
                    fontStyle: 'italic'
                  }}>
                    All aspects have been assigned
                  </div>
                )}

                {aspects.length === 0 && (
                  <div style={{
                    ...typography.bodySm,
                    color: colors.textSecondary
                  }}>
                    No aspects available. Create aspects in the Aspects page to tag your friends.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                textAlign: 'center',
                color: colors.textSecondary
              }}>
                <div style={{
                  ...typography.headingMd,
                  fontWeight: 600,
                  color: colors.textPrimary,
                  marginBottom: '8px'
                }}>
                  {activeTab === 'friends' ? (
                    friends.length === 0 ? 'No friends yet' : 'Select a friend'
                  ) : (
                    pendingRequests.length === 0 ? 'No requests' : 'Review requests'
                  )}
                </div>
                <div style={{
                  ...typography.bodySm,
                  color: colors.textSecondary
                }}>
                  {activeTab === 'friends'
                    ? 'Select a friend to view and edit their details'
                    : 'Review and respond to friend requests'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
