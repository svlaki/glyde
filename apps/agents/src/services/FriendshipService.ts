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

export interface Friend {
  friend_id: string
  friend_email: string
  friend_display_name: string
  friendship_status: string
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

      // 6. Log to user_activity_log
      await this.supabase
        .from('user_activity_log')
        .insert({
          user_id: requesterId,
          entity_type: 'friendship',
          entity_id: friendship.id,
          operation: 'create',
          changes: {
            status: 'pending',
            target_user_id: addresseeId
          },
          source: 'user'
        })
        .throwOnError()

      // 7. Create user_interaction for addressee (notification)
      await this.supabase
        .from('user_interactions')
        .insert({
          user_id: addresseeId,
          interaction_type: 'friend_request',
          question: `Would you like to accept a friend request?`,
          metadata: {
            friendship_id: friendship.id,
            requester_id: requesterId
          }
        })
        .throwOnError()

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

      // 3. Log to user_activity_log
      await this.supabase
        .from('user_activity_log')
        .insert({
          user_id: userId,
          entity_type: 'friendship',
          entity_id: friendshipId,
          operation: 'update',
          changes: {
            status: { from: 'pending', to: 'accepted' }
          },
          source: 'user'
        })
        .throwOnError()

      // 4. Create user_interaction for requester (notification)
      await this.supabase
        .from('user_interactions')
        .insert({
          user_id: friendship.requester_id,
          interaction_type: 'friend_request_accepted',
          question: `Friend request accepted`,
          metadata: {
            friendship_id: friendshipId
          }
        })
        .throwOnError()

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

        // Log blocking
        await this.supabase
          .from('user_activity_log')
          .insert({
            user_id: userId,
            entity_type: 'friendship',
            entity_id: friendshipId,
            operation: 'update',
            changes: {
              status: { from: 'pending', to: 'blocked' }
            },
            source: 'user'
          })
          .throwOnError()
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

        // Log declining
        await this.supabase
          .from('user_activity_log')
          .insert({
            user_id: userId,
            entity_type: 'friendship',
            entity_id: friendshipId,
            operation: 'delete',
            changes: {
              reason: 'declined'
            },
            source: 'user'
          })
          .throwOnError()
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
      const { data: friends, error } = await this.supabase
        .rpc('get_user_friends', { p_user_id: userId })

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch friends'
        }
      }

      return {
        success: true,
        data: friends || []
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
      const { data: requests, error } = await this.supabase
        .from('user_friendships')
        .select(
          `
          id,
          requester_id,
          status,
          created_at,
          requester:profile!requester_id(email, display_name, avatar_url)
          `
        )
        .eq('addressee_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch friend requests'
        }
      }

      const formattedRequests = requests?.map((req: any) => ({
        id: req.id,
        requester_id: req.requester_id,
        requester_email: req.requester.email,
        requester_display_name: req.requester.display_name,
        requester_avatar_url: req.requester.avatar_url,
        status: req.status,
        created_at: req.created_at
      })) || []

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

      // 3. Log to user_activity_log
      await this.supabase
        .from('user_activity_log')
        .insert({
          user_id: userId,
          entity_type: 'friendship',
          entity_id: friendshipId,
          operation: 'delete',
          changes: {
            reason: 'user_removed'
          },
          source: 'user'
        })
        .throwOnError()

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
}
