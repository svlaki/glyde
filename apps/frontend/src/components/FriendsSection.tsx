import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  getPendingRequests,
  removeFriend,
  Friend,
  FriendRequest
} from '../lib/friendshipService'

export function FriendsSection() {
  const { user, session } = useAuth()
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [newFriendEmail, setNewFriendEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends')

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
      // Optionally reload friends list
    } else {
      setError(response.error || 'Failed to send friend request')
    }

    setLoading(false)
  }

  async function handleAcceptRequest(friendshipId: string) {
    if (!accessToken) return

    const response = await acceptFriendRequest(friendshipId, accessToken)
    if (response.success) {
      // Remove from pending and reload friends
      setPendingRequests(pendingRequests.filter(r => r.id !== friendshipId))
      loadFriends()
    } else {
      setError(response.error || 'Failed to accept request')
    }
  }

  async function handleDeclineRequest(friendshipId: string, block: boolean = false) {
    if (!accessToken) return

    const response = await declineFriendRequest(friendshipId, block, accessToken)
    if (response.success) {
      setPendingRequests(pendingRequests.filter(r => r.id !== friendshipId))
    } else {
      setError(response.error || 'Failed to decline request')
    }
  }

  async function handleRemoveFriend(friendshipId: string) {
    if (!accessToken) return
    if (!confirm('Are you sure you want to remove this friend?')) return

    const response = await removeFriend(friendshipId, accessToken)
    if (response.success) {
      loadFriends()
    } else {
      setError(response.error || 'Failed to remove friend')
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Friends</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      {/* Add Friend Form */}
      <div className="mb-6">
        <form onSubmit={handleSendRequest} className="flex gap-2">
          <input
            type="email"
            placeholder="Enter friend's email"
            value={newFriendEmail}
            onChange={(e) => setNewFriendEmail(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Add Friend'}
          </button>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('friends')}
          className={`pb-2 px-2 font-medium ${
            activeTab === 'friends'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-2 px-2 font-medium relative ${
            activeTab === 'requests'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 inline-block bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Friends List */}
      {activeTab === 'friends' && (
        <div>
          {friends.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No friends yet. Add one above!</p>
          ) : (
            <div className="space-y-3">
              {friends.map((friend) => (
                <div key={friend.friend_id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="font-medium">{friend.friend_display_name}</div>
                    <div className="text-sm text-gray-600">{friend.friend_email}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveFriend(friend.friend_id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending Requests */}
      {activeTab === 'requests' && (
        <div>
          {pendingRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="font-medium">{request.requester_display_name}</div>
                    <div className="text-sm text-gray-600">{request.requester_email}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptRequest(request.id)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(request.id, false)}
                      className="px-3 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(request.id, true)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      title="Block this user"
                    >
                      Block
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
