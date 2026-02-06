import { SupabaseClient } from '@supabase/supabase-js'
import { ApiResponse } from '../types/api.js'

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
  updated_at: string
}

export interface FriendAspect {
  id: string
  name: string
  color: string
  icon?: string
}

export interface Friend {
  friendship_id: string
  friend_id: string
  friend_email: string
  friend_display_name: string
  friend_avatar_url?: string
  friendship_status: string
  notes?: string
  aspects: FriendAspect[]
  created_at: string
}

export interface FriendRequest {
  id: string
  requester_id: string
  requester_email: string
  requester_display_name: string
  requester_avatar_url?: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
}

export interface CreateFriendshipDto {
  addresseeEmail: string
}

export class FriendshipService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Send a friend request to a user by email
   */
  async sendFriendRequest(
    requesterId: string,
    addresseeEmail: string
  ): Promise<ApiResponse<Friendship>> {
    try {
      // 1. Find addressee by email
      const { data: addresseeData, error: addresseeError } = await this.supabase
        .from('profile')
        .select('id')
        .eq('email', addresseeEmail)
        .single()

      if (addresseeError || !addresseeData) {
        return {
          success: false,
          error: 'User not found'
        }
      }

      const addresseeId = addresseeData.id

      // 2. Check for self-friendship
      if (requesterId === addresseeId) {
        return {
          success: false,
          error: 'Cannot send friend request to yourself'
        }
      }

      // 3. Check for existing friendship (either direction)
      const { data: existingFriendship, error: lookupError } = await this.supabase
        .from('user_friendships')
        .select('id, status')
        .or(
          `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),` +
          `and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`
        )
        .maybeSingle()

      if (existingFriendship) {
        return {
          success: false,
          error: `Already ${existingFriendship.status === 'blocked' ? 'blocked by' : 'connected with'} this user`
        }
      }

      // 4. Check if addressee blocked requester
      const { data: blockData } = await this.supabase
        .rpc('is_user_blocked', {
          p_requester_id: requesterId,
          p_addressee_id: addresseeId
        })

      if (blockData) {
        return {
          success: false,
          error: 'This user has blocked you'
        }
      }

      // 5. Create friendship with status='pending'
      const { data: friendship, error: createError } = await this.supabase
        .from('user_friendships')
        .insert({
          requester_id: requesterId,
          addressee_id: addresseeId,
          status: 'pending'
        })
        .select()
        .single()

      if (createError) {
        return {
          success: false,
          error: 'Failed to send friend request'
        }
      }

      return {
        success: true,
        data: friendship
      }
    } catch (error) {
      console.error('Error sending friend request:', error)
      return {
        success: false,
        error: 'Failed to send friend request'
      }
    }
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(
    friendshipId: string,
    userId: string
  ): Promise<ApiResponse<Friendship>> {
    try {
      // 1. Verify userId is addressee and get friendship
      const { data: friendship, error: lookupError } = await this.supabase
        .from('user_friendships')
        .select('*')
        .eq('id', friendshipId)
        .single()

      if (lookupError || !friendship) {
        return {
          success: false,
          error: 'Friendship request not found'
        }
      }

      if (friendship.addressee_id !== userId) {
        return {
          success: false,
          error: 'You do not have permission to accept this request'
        }
      }

      // 2. Update status to 'accepted'
      const { data: updated, error: updateError } = await this.supabase
        .from('user_friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId)
        .select()
        .single()

      if (updateError) {
        return {
          success: false,
          error: 'Failed to accept friend request'
        }
      }

      return {
        success: true,
        data: updated
      }
    } catch (error) {
      console.error('Error accepting friend request:', error)
      return {
        success: false,
        error: 'Failed to accept friend request'
      }
    }
  }

  /**
   * Decline or block a friend request
   */
  async declineFriendRequest(
    friendshipId: string,
    userId: string,
    block: boolean = false
  ): Promise<ApiResponse<void>> {
    try {
      // 1. Verify userId is addressee
      const { data: friendship, error: lookupError } = await this.supabase
        .from('user_friendships')
        .select('*')
        .eq('id', friendshipId)
        .single()

      if (lookupError || !friendship) {
        return {
          success: false,
          error: 'Friendship request not found'
        }
      }

      if (friendship.addressee_id !== userId) {
        return {
          success: false,
          error: 'You do not have permission to decline this request'
        }
      }

      if (block) {
        // 2. Update status to 'blocked'
        const { error: updateError } = await this.supabase
          .from('user_friendships')
          .update({ status: 'blocked', updated_at: new Date().toISOString() })
          .eq('id', friendshipId)

        if (updateError) {
          return {
            success: false,
            error: 'Failed to block user'
          }
        }

      } else {
        // 3. Delete record if declining
        const { error: deleteError } = await this.supabase
          .from('user_friendships')
          .delete()
          .eq('id', friendshipId)

        if (deleteError) {
          return {
            success: false,
            error: 'Failed to decline friend request'
          }
        }

      }

      return {
        success: true
      }
    } catch (error) {
      console.error('Error declining friend request:', error)
      return {
        success: false,
        error: 'Failed to decline friend request'
      }
    }
  }

  /**
   * Get all accepted friends for a user
   */
  async getFriends(userId: string): Promise<ApiResponse<Friend[]>> {
    try {
      // Step 1: Fetch accepted friendships
      const { data: friendships, error: friendshipError } = await this.supabase
        .from('user_friendships')
        .select('id, requester_id, addressee_id, status, notes, created_at')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })

      if (friendshipError) {
        console.error('Error fetching friendships:', friendshipError)
        return {
          success: false,
          error: 'Failed to fetch friends'
        }
      }

      if (!friendships || friendships.length === 0) {
        return {
          success: true,
          data: []
        }
      }

      // Step 2: Get friend IDs (the other person in each friendship)
      const friendIds = friendships.map(f =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      )
      const friendshipIds = friendships.map(f => f.id)

      // Step 3: Fetch profiles for all friends
      const { data: profiles, error: profileError } = await this.supabase
        .from('profile')
        .select('id, email, display_name, avatar_url')
        .in('id', friendIds)

      if (profileError) {
        console.error('Error fetching profiles:', profileError)
        return {
          success: false,
          error: 'Failed to fetch friends'
        }
      }

      // Step 4: Fetch aspects for all friendships
      const { data: friendAspects, error: aspectError } = await this.supabase
        .from('friend_aspects')
        .select('friendship_id, aspect_id, aspects!inner(id, name, color, icon)')
        .in('friendship_id', friendshipIds)

      // Build profile and aspect maps
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
      const aspectMap = new Map<string, FriendAspect[]>()

      if (friendAspects && !aspectError) {
        for (const fa of friendAspects) {
          const existing = aspectMap.get(fa.friendship_id) || []
          const asp = fa.aspects as unknown as { id: string; name: string; color: string; icon?: string }
          existing.push({
            id: asp.id,
            name: asp.name,
            color: asp.color,
            icon: asp.icon
          })
          aspectMap.set(fa.friendship_id, existing)
        }
      }

      // Step 5: Combine the data
      const friends: Friend[] = friendships.map(friendship => {
        const friendId = friendship.requester_id === userId
          ? friendship.addressee_id
          : friendship.requester_id
        const profile = profileMap.get(friendId)

        return {
          friendship_id: friendship.id,
          friend_id: friendId,
          friend_email: profile?.email || '',
          friend_display_name: profile?.display_name || 'Unknown',
          friend_avatar_url: profile?.avatar_url,
          friendship_status: friendship.status,
          notes: friendship.notes || undefined,
          aspects: aspectMap.get(friendship.id) || [],
          created_at: friendship.created_at
        }
      })

      return {
        success: true,
        data: friends
      }
    } catch (error) {
      console.error('Error getting friends:', error)
      return {
        success: false,
        error: 'Failed to fetch friends'
      }
    }
  }

  /**
   * Get pending friend requests (incoming) for a user
   */
  async getPendingRequests(userId: string): Promise<ApiResponse<FriendRequest[]>> {
    try {
      // Step 1: Fetch pending friendships
      const { data: friendships, error: friendshipError } = await this.supabase
        .from('user_friendships')
        .select('id, requester_id, status, created_at')
        .eq('addressee_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (friendshipError) {
        console.error('Error fetching friendships:', friendshipError)
        return {
          success: false,
          error: 'Failed to fetch friend requests'
        }
      }

      if (!friendships || friendships.length === 0) {
        return {
          success: true,
          data: []
        }
      }

      // Step 2: Fetch profile data for all requesters
      const requesterIds = friendships.map(f => f.requester_id)
      const { data: profiles, error: profileError } = await this.supabase
        .from('profile')
        .select('id, email, display_name, avatar_url')
        .in('id', requesterIds)

      if (profileError) {
        console.error('Error fetching profiles:', profileError)
        return {
          success: false,
          error: 'Failed to fetch friend requests'
        }
      }

      // Step 3: Combine the data
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
      const formattedRequests = friendships.map(friendship => {
        const profile = profileMap.get(friendship.requester_id)
        return {
          id: friendship.id,
          requester_id: friendship.requester_id,
          requester_email: profile?.email || '',
          requester_display_name: profile?.display_name || 'Unknown',
          requester_avatar_url: profile?.avatar_url,
          status: friendship.status as 'pending' | 'accepted' | 'blocked',
          created_at: friendship.created_at
        }
      })

      return {
        success: true,
        data: formattedRequests
      }
    } catch (error) {
      console.error('Error getting pending requests:', error)
      return {
        success: false,
        error: 'Failed to fetch friend requests'
      }
    }
  }

  /**
   * Check if two users are friends
   */
  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    try {
      const { data: result, error } = await this.supabase
        .rpc('are_users_friends', {
          p_user_id_1: userId1,
          p_user_id_2: userId2
        })

      return !error && result === true
    } catch (error) {
      console.error('Error checking friendship:', error)
      return false
    }
  }

  /**
   * Remove a friend (delete friendship record)
   */
  async removeFriend(friendshipId: string, userId: string): Promise<ApiResponse<void>> {
    try {
      // 1. Verify userId is part of friendship
      const { data: friendship, error: lookupError } = await this.supabase
        .from('user_friendships')
        .select('*')
        .eq('id', friendshipId)
        .single()

      if (lookupError || !friendship) {
        return {
          success: false,
          error: 'Friendship not found'
        }
      }

      if (friendship.requester_id !== userId && friendship.addressee_id !== userId) {
        return {
          success: false,
          error: 'You do not have permission to remove this friendship'
        }
      }

      // 2. Delete record
      const { error: deleteError } = await this.supabase
        .from('user_friendships')
        .delete()
        .eq('id', friendshipId)

      if (deleteError) {
        return {
          success: false,
          error: 'Failed to remove friend'
        }
      }

      return {
        success: true
      }
    } catch (error) {
      console.error('Error removing friend:', error)
      return {
        success: false,
        error: 'Failed to remove friend'
      }
    }
  }

  /**
   * Update notes for a friendship
   */
  async updateFriendNotes(
    friendshipId: string,
    userId: string,
    notes: string
  ): Promise<ApiResponse<void>> {
    try {
      // Verify userId is part of friendship
      const { data: friendship, error: lookupError } = await this.supabase
        .from('user_friendships')
        .select('requester_id, addressee_id')
        .eq('id', friendshipId)
        .single()

      if (lookupError || !friendship) {
        return {
          success: false,
          error: 'Friendship not found'
        }
      }

      if (friendship.requester_id !== userId && friendship.addressee_id !== userId) {
        return {
          success: false,
          error: 'You do not have permission to update this friendship'
        }
      }

      // Update notes
      const { error: updateError } = await this.supabase
        .from('user_friendships')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', friendshipId)

      if (updateError) {
        return {
          success: false,
          error: 'Failed to update notes'
        }
      }

      return {
        success: true
      }
    } catch (error) {
      console.error('Error updating friend notes:', error)
      return {
        success: false,
        error: 'Failed to update notes'
      }
    }
  }

  /**
   * Add an aspect to a friendship
   */
  async addFriendAspect(
    friendshipId: string,
    userId: string,
    aspectId: string
  ): Promise<ApiResponse<void>> {
    try {
      // Verify userId is part of friendship
      const { data: friendship, error: lookupError } = await this.supabase
        .from('user_friendships')
        .select('requester_id, addressee_id')
        .eq('id', friendshipId)
        .single()

      if (lookupError || !friendship) {
        return {
          success: false,
          error: 'Friendship not found'
        }
      }

      if (friendship.requester_id !== userId && friendship.addressee_id !== userId) {
        return {
          success: false,
          error: 'You do not have permission to update this friendship'
        }
      }

      // Verify aspect belongs to user
      const { data: aspect, error: aspectError } = await this.supabase
        .from('aspects')
        .select('id')
        .eq('id', aspectId)
        .eq('user_id', userId)
        .single()

      if (aspectError || !aspect) {
        return {
          success: false,
          error: 'Aspect not found'
        }
      }

      // Add aspect (ignore if already exists)
      const { error: insertError } = await this.supabase
        .from('friend_aspects')
        .upsert({
          friendship_id: friendshipId,
          aspect_id: aspectId
        }, { onConflict: 'friendship_id,aspect_id' })

      if (insertError) {
        return {
          success: false,
          error: 'Failed to add aspect'
        }
      }

      return {
        success: true
      }
    } catch (error) {
      console.error('Error adding friend aspect:', error)
      return {
        success: false,
        error: 'Failed to add aspect'
      }
    }
  }

  /**
   * Remove an aspect from a friendship
   */
  async removeFriendAspect(
    friendshipId: string,
    userId: string,
    aspectId: string
  ): Promise<ApiResponse<void>> {
    try {
      // Verify userId is part of friendship
      const { data: friendship, error: lookupError } = await this.supabase
        .from('user_friendships')
        .select('requester_id, addressee_id')
        .eq('id', friendshipId)
        .single()

      if (lookupError || !friendship) {
        return {
          success: false,
          error: 'Friendship not found'
        }
      }

      if (friendship.requester_id !== userId && friendship.addressee_id !== userId) {
        return {
          success: false,
          error: 'You do not have permission to update this friendship'
        }
      }

      // Remove aspect
      const { error: deleteError } = await this.supabase
        .from('friend_aspects')
        .delete()
        .eq('friendship_id', friendshipId)
        .eq('aspect_id', aspectId)

      if (deleteError) {
        return {
          success: false,
          error: 'Failed to remove aspect'
        }
      }

      return {
        success: true
      }
    } catch (error) {
      console.error('Error removing friend aspect:', error)
      return {
        success: false,
        error: 'Failed to remove aspect'
      }
    }
  }
}
