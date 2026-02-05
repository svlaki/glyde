import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import {
  createSharedAspect,
  getUserSharedAspects,
  getAspectMembers,
  addMember,
  removeMember,
  updateMemberRole,
  deleteSharedAspect,
  SharedAspect,
  SharedAspectMember
} from '../lib/sharedAspectService'
import { getFriends, Friend } from '../lib/friendshipService'

export function SharedAspectsSection() {
  const { user, session } = useAuth()
  const [aspects, setAspects] = useState<SharedAspect[]>([])
  const [selectedAspectId, setSelectedAspectId] = useState<string | null>(null)
  const [members, setMembers] = useState<SharedAspectMember[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [newAspectName, setNewAspectName] = useState('')
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

    const response = await createSharedAspect(newAspectName, accessToken)
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

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Shared Aspects</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Aspects List */}
        <div className="col-span-1">
          <h3 className="font-semibold mb-4">Your Aspects</h3>

          {/* Create new aspect form */}
          <form onSubmit={handleCreateAspect} className="mb-6 p-4 bg-gray-50 rounded">
            <input
              type="text"
              placeholder="New aspect name"
              value={newAspectName}
              onChange={(e) => setNewAspectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loading ? 'Creating...' : 'Create Aspect'}
            </button>
          </form>

          {/* Aspects list */}
          <div className="space-y-2">
            {aspects.length === 0 ? (
              <p className="text-gray-500 text-sm">No shared aspects yet</p>
            ) : (
              aspects.map((aspect) => (
                <button
                  key={aspect.id}
                  onClick={() => setSelectedAspectId(aspect.id)}
                  className={`w-full text-left p-3 rounded transition ${
                    selectedAspectId === aspect.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <div className="font-medium">{aspect.name}</div>
                  <div className="text-xs">
                    {aspect.icon && <span className="mr-2">{aspect.icon}</span>}
                    {aspect.owner_id === user?.id ? 'Owner' : 'Member'}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Aspect Details and Members */}
        {currentAspect && (
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-semibold">{currentAspect.name}</h3>
                {currentAspect.description && (
                  <p className="text-sm text-gray-600 mt-1">{currentAspect.description}</p>
                )}
              </div>
              {isOwner && (
                <button
                  onClick={() => handleDeleteAspect(currentAspect.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Delete
                </button>
              )}
            </div>

            {/* Add member form (only for owner/editor) */}
            {(isOwner || members.find(m => m.user_id === user?.id && m.role === 'editor')) && (
              <form onSubmit={handleAddMember} className="mb-6 p-4 bg-gray-50 rounded">
                <label className="text-sm font-medium block mb-2">Add Friend</label>
                <div className="flex gap-2 mb-2">
                  <select
                    value={selectedFriendId}
                    onChange={(e) => setSelectedFriendId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
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
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="submit"
                    disabled={loading || !selectedFriendId}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {loading ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>
            )}

            {/* Members list */}
            <div>
              <h4 className="font-semibold mb-3">Members ({members.length})</h4>
              <div className="space-y-2">
                {members.length === 0 ? (
                  <p className="text-gray-500 text-sm">No members yet</p>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium text-sm">
                          {member.user?.display_name}
                          {member.user_id === currentAspect.owner_id && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">{member.user?.email}</div>
                      </div>
                      {isOwner && member.role !== 'owner' && (
                        <div className="flex gap-2">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleUpdateMemberRole(member.id, e.target.value as 'editor' | 'viewer')
                            }
                            className="text-xs px-2 py-1 border border-gray-300 rounded"
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
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
        )}
      </div>
    </div>
  )
}
