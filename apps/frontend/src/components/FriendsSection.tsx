import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import { usePlatform } from '../hooks/usePlatform'
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
import { getTypography } from '../styles/typography'
import { FriendListItem } from './FriendListItem'
import { FriendRequestItem } from './FriendRequestItem'
import { FriendDetailPanel } from './FriendDetailPanel'
import { MobileHeader } from './mobile/MobileHeader'

interface FriendsSectionProps {
  isMobileOverride?: boolean
}

export function FriendsSection({ isMobileOverride }: FriendsSectionProps) {
  const { user, session } = useAuth()
  const { theme } = useTheme()
  const { aspects } = useAspects()
  const { isMobile: platformMobile } = usePlatform()
  const isMobile = isMobileOverride ?? platformMobile
  const colors = getColors(theme)
  const typography = getTypography(isMobile)

  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [newFriendEmail, setNewFriendEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends')
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [showingDetail, setShowingDetail] = useState(false)

  const accessToken = session?.access_token

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
      if (selectedFriend) {
        const updated = response.data.find(f => f.friendship_id === selectedFriend.friendship_id)
        if (updated) {
          setSelectedFriend(updated)
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
      setPendingRequests(prev => prev.filter(r => r.id !== friendshipId))
      loadFriends()
      setError(null)
    } else {
      setError(response.error || 'Failed to accept request')
    }
  }

  async function handleDeclineRequest(friendshipId: string) {
    if (!accessToken) return
    const response = await declineFriendRequest(friendshipId, false, accessToken)
    if (response.success) {
      setPendingRequests(prev => prev.filter(r => r.id !== friendshipId))
      setError(null)
    } else {
      setError(response.error || 'Failed to decline request')
    }
  }

  async function handleBlockRequest(friendshipId: string) {
    if (!accessToken) return
    const response = await declineFriendRequest(friendshipId, true, accessToken)
    if (response.success) {
      setPendingRequests(prev => prev.filter(r => r.id !== friendshipId))
      setError(null)
    } else {
      setError(response.error || 'Failed to block user')
    }
  }

  async function handleRemoveFriend(friendshipId: string) {
    if (!accessToken) return
    if (!confirm('Are you sure you want to remove this friend?')) return

    const response = await removeFriend(friendshipId, accessToken)
    if (response.success) {
      if (selectedFriend?.friendship_id === friendshipId) {
        setSelectedFriend(null)
        setShowingDetail(false)
      }
      loadFriends()
      setError(null)
    } else {
      setError(response.error || 'Failed to remove friend')
    }
  }

  function handleSelectFriend(friend: Friend) {
    setSelectedFriend(friend)
    if (isMobile) {
      setShowingDetail(true)
    }
  }

  async function handleSaveNotes(friendshipId: string, notes: string) {
    if (!accessToken) return
    const response = await updateFriendNotes(friendshipId, notes, accessToken)
    if (response.success) {
      loadFriends()
    } else {
      setError(response.error || 'Failed to save notes')
    }
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

  // --- Mobile: detail view ---
  if (isMobile && showingDetail && selectedFriend) {
    return (
      <>
        <MobileHeader
          title={selectedFriend.friend_display_name || 'Friend'}
          onBack={() => setShowingDetail(false)}
        />
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          background: colors.bgPrimary,
          WebkitOverflowScrolling: 'touch'
        }}>
          <FriendDetailPanel
            friend={selectedFriend}
            isMobile={true}
            colors={colors}
            typography={typography}
            aspects={aspects}
            onSaveNotes={handleSaveNotes}
            onAddAspect={handleAddAspect}
            onRemoveAspect={handleRemoveAspect}
            onRemoveFriend={handleRemoveFriend}
          />
        </div>
      </>
    )
  }

  // --- Mobile: list view ---
  if (isMobile) {
    return (
      <>
      <MobileHeader title="Friends" showMenu={true} showSearch={true} />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: colors.bgPrimary
      }}>
        {/* Add Friend Form */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <form onSubmit={handleSendRequest}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                placeholder="friend@example.com"
                value={newFriendEmail}
                onChange={(e) => setNewFriendEmail(e.target.value)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  ...typography.bodySm,
                  fontSize: '16px', // Prevent iOS zoom
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  background: colors.bgSecondary,
                  color: colors.textPrimary,
                  outline: 'none',
                  minHeight: '44px'
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 16px',
                  ...typography.labelLg,
                  fontWeight: 500,
                  background: colors.bgTertiary,
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  minHeight: '44px'
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
          gap: '16px'
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
              minHeight: '44px'
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
              position: 'relative',
              minHeight: '44px'
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

        {/* List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          WebkitOverflowScrolling: 'touch'
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
                friends.map(friend => (
                  <FriendListItem
                    key={friend.friendship_id}
                    friend={friend}
                    isSelected={selectedFriend?.friendship_id === friend.friendship_id}
                    isMobile={true}
                    colors={colors}
                    typography={typography}
                    onClick={() => handleSelectFriend(friend)}
                  />
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
                pendingRequests.map(request => (
                  <FriendRequestItem
                    key={request.id}
                    request={request}
                    isMobile={true}
                    colors={colors}
                    typography={typography}
                    onAccept={handleAcceptRequest}
                    onDecline={handleDeclineRequest}
                    onBlock={handleBlockRequest}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
      </>
    )
  }

  // --- Desktop layout ---
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
                  friends.map(friend => (
                    <FriendListItem
                      key={friend.friendship_id}
                      friend={friend}
                      isSelected={selectedFriend?.friendship_id === friend.friendship_id}
                      colors={colors}
                      typography={typography}
                      onClick={() => handleSelectFriend(friend)}
                    />
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
                  pendingRequests.map(request => (
                    <FriendRequestItem
                      key={request.id}
                      request={request}
                      colors={colors}
                      typography={typography}
                      onAccept={handleAcceptRequest}
                      onDecline={handleDeclineRequest}
                      onBlock={handleBlockRequest}
                    />
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
            <FriendDetailPanel
              friend={selectedFriend}
              colors={colors}
              typography={typography}
              aspects={aspects}
              onSaveNotes={handleSaveNotes}
              onAddAspect={handleAddAspect}
              onRemoveAspect={handleRemoveAspect}
              onRemoveFriend={handleRemoveFriend}
            />
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
