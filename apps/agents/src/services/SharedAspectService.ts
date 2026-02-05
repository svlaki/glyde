import { SupabaseClient } from '@supabase/supabase-js'
import { ApiResponse } from '../types/api.js'
import { FriendshipService } from './FriendshipService.js'

export interface SharedAspect {
  id: string
  name: string
  description?: string
  color?: string
  icon?: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface SharedAspectMember {
  id: string
  aspect_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  joined_at: string
  user?: {
    id: string
    email: string
    display_name: string
    avatar_url?: string
  }
}

export interface CreateSharedAspectDto {
  name: string
  description?: string
  color?: string
  icon?: string
}

export interface UpdateSharedAspectDto {
  name?: string
  description?: string
  color?: string
  icon?: string
}

export class SharedAspectService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new shared aspect
   */
  async createSharedAspect(
    ownerId: string,
    data: CreateSharedAspectDto
  ): Promise<ApiResponse<SharedAspect>> {
    try {
      // 1. Create the aspect
      const { data: aspect, error: createError } = await this.supabase
        .from('shared_aspects')
        .insert({
          name: data.name,
          description: data.description || null,
          color: data.color || null,
          icon: data.icon || null,
          owner_id: ownerId
        })
        .select()
        .single()

      if (createError || !aspect) {
        return {
          success: false,
          error: 'Failed to create shared aspect'
        }
      }

      // 2. Add owner as member with role='owner'
      const { error: memberError } = await this.supabase
        .from('shared_aspect_members')
        .insert({
          aspect_id: aspect.id,
          user_id: ownerId,
          role: 'owner'
        })

      if (memberError) {
        // Clean up the aspect if member creation fails
        await this.supabase
          .from('shared_aspects')
          .delete()
          .eq('id', aspect.id)

        return {
          success: false,
          error: 'Failed to initialize aspect'
        }
      }

      // 3. Log activity
      await this.supabase
        .from('user_activity_log')
        .insert({
          user_id: ownerId,
          entity_type: 'shared_aspect',
          entity_id: aspect.id,
          operation: 'create',
          changes: {
            name: data.name
          },
          source: 'user'
        })
        .throwOnError()

      return {
        success: true,
        data: aspect
      }
    } catch (error) {
      console.error('Error creating shared aspect:', error)
      return {
        success: false,
        error: 'Failed to create shared aspect'
      }
    }
  }

  /**
   * Add a member to a shared aspect
   */
  async addMember(
    aspectId: string,
    userId: string,
    invitedUserId: string,
    role: 'editor' | 'viewer'
  ): Promise<ApiResponse<SharedAspectMember>> {
    try {
      // 1. Verify userId is owner or editor
      const { data: userMember, error: memberCheckError } = await this.supabase
        .from('shared_aspect_members')
        .select('role')
        .eq('aspect_id', aspectId)
        .eq('user_id', userId)
        .single()

      if (memberCheckError || !userMember || (userMember.role !== 'owner' && userMember.role !== 'editor')) {
        return {
          success: false,
          error: 'You do not have permission to add members'
        }
      }

      // 2. Verify invited user is a friend
      const friendshipService = new FriendshipService(this.supabase)
      const areFriends = await friendshipService.areFriends(userId, invitedUserId)
      if (!areFriends) {
        return {
          success: false,
          error: 'You can only add friends to shared aspects'
        }
      }

      // 3. Check if already a member
      const { data: existingMember } = await this.supabase
        .from('shared_aspect_members')
        .select('id')
        .eq('aspect_id', aspectId)
        .eq('user_id', invitedUserId)
        .maybeSingle()

      if (existingMember) {
        return {
          success: false,
          error: 'User is already a member of this aspect'
        }
      }

      // 4. Create member record
      const { data: newMember, error: insertError } = await this.supabase
        .from('shared_aspect_members')
        .insert({
          aspect_id: aspectId,
          user_id: invitedUserId,
          role
        })
        .select()
        .single()

      if (insertError || !newMember) {
        return {
          success: false,
          error: 'Failed to add member'
        }
      }

      // 5. Log activity
      await this.supabase
        .from('user_activity_log')
        .insert({
          user_id: userId,
          entity_type: 'shared_aspect_member',
          entity_id: newMember.id,
          operation: 'create',
          changes: {
            invited_user_id: invitedUserId,
            role
          },
          source: 'user'
        })
        .throwOnError()

      // 6. Create user interaction for invited user
      await this.supabase
        .from('user_interactions')
        .insert({
          user_id: invitedUserId,
          interaction_type: 'shared_aspect_invite',
          question: 'You have been invited to a shared aspect',
          metadata: {
            aspect_id: aspectId,
            inviter_id: userId,
            role
          }
        })
        .throwOnError()

      return {
        success: true,
        data: newMember
      }
    } catch (error) {
      console.error('Error adding member:', error)
      return {
        success: false,
        error: 'Failed to add member'
      }
    }
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    aspectId: string,
    userId: string,
    memberId: string,
    newRole: 'editor' | 'viewer'
  ): Promise<ApiResponse<SharedAspectMember>> {
    try {
      // 1. Verify userId is owner
      const { data: userMember, error: ownerCheckError } = await this.supabase
        .from('shared_aspect_members')
        .select('role')
        .eq('aspect_id', aspectId)
        .eq('user_id', userId)
        .single()

      if (ownerCheckError || !userMember || userMember.role !== 'owner') {
        return {
          success: false,
          error: 'Only owners can change member roles'
        }
      }

      // 2. Get member to update
      const { data: member, error: memberError } = await this.supabase
        .from('shared_aspect_members')
        .select('*')
        .eq('id', memberId)
        .eq('aspect_id', aspectId)
        .single()

      if (memberError || !member) {
        return {
          success: false,
          error: 'Member not found'
        }
      }

      // 3. Cannot change owner's role
      if (member.role === 'owner') {
        return {
          success: false,
          error: 'Cannot change owner role'
        }
      }

      // 4. Update role
      const { data: updated, error: updateError } = await this.supabase
        .from('shared_aspect_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .select()
        .single()

      if (updateError) {
        return {
          success: false,
          error: 'Failed to update member role'
        }
      }

      return {
        success: true,
        data: updated
      }
    } catch (error) {
      console.error('Error updating member role:', error)
      return {
        success: false,
        error: 'Failed to update member role'
      }
    }
  }

  /**
   * Remove a member from shared aspect
   */
  async removeMember(
    aspectId: string,
    userId: string,
    memberId: string
  ): Promise<ApiResponse<void>> {
    try {
      // 1. Verify userId is owner
      const { data: userMember, error: ownerCheckError } = await this.supabase
        .from('shared_aspect_members')
        .select('role')
        .eq('aspect_id', aspectId)
        .eq('user_id', userId)
        .single()

      if (ownerCheckError || !userMember || userMember.role !== 'owner') {
        return {
          success: false,
          error: 'Only owners can remove members'
        }
      }

      // 2. Get member info before deletion
      const { data: member, error: memberError } = await this.supabase
        .from('shared_aspect_members')
        .select('*')
        .eq('id', memberId)
        .eq('aspect_id', aspectId)
        .single()

      if (memberError) {
        return {
          success: false,
          error: 'Member not found'
        }
      }

      // 3. Cannot remove owner
      if (member.role === 'owner') {
        return {
          success: false,
          error: 'Cannot remove the owner from aspect'
        }
      }

      // 4. Delete member
      const { error: deleteError } = await this.supabase
        .from('shared_aspect_members')
        .delete()
        .eq('id', memberId)

      if (deleteError) {
        return {
          success: false,
          error: 'Failed to remove member'
        }
      }

      return {
        success: true
      }
    } catch (error) {
      console.error('Error removing member:', error)
      return {
        success: false,
        error: 'Failed to remove member'
      }
    }
  }

  /**
   * Get user's shared aspects (owned or member of)
   */
  async getUserSharedAspects(userId: string): Promise<ApiResponse<SharedAspect[]>> {
    try {
      const { data: aspects, error } = await this.supabase
        .from('shared_aspects')
        .select('*')
        .or(`owner_id.eq.${userId},id.in.(SELECT aspect_id FROM shared_aspect_members WHERE user_id='${userId}')`)
        .order('created_at', { ascending: false })

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch shared aspects'
        }
      }

      return {
        success: true,
        data: aspects || []
      }
    } catch (error) {
      console.error('Error fetching user shared aspects:', error)
      return {
        success: false,
        error: 'Failed to fetch shared aspects'
      }
    }
  }

  /**
   * Get members of a shared aspect
   */
  async getAspectMembers(
    aspectId: string,
    userId: string
  ): Promise<ApiResponse<SharedAspectMember[]>> {
    try {
      // Verify user has access to aspect
      const { data: userAccess } = await this.supabase
        .from('shared_aspect_members')
        .select('id')
        .eq('aspect_id', aspectId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!userAccess) {
        const { data: aspect } = await this.supabase
          .from('shared_aspects')
          .select('owner_id')
          .eq('id', aspectId)
          .single()

        if (!aspect || aspect.owner_id !== userId) {
          return {
            success: false,
            error: 'You do not have access to this aspect'
          }
        }
      }

      // Fetch members with user profile info
      const { data: members, error } = await this.supabase
        .from('shared_aspect_members')
        .select(
          `
          id,
          aspect_id,
          user_id,
          role,
          joined_at,
          user:profile!user_id(id, email, display_name, avatar_url)
          `
        )
        .eq('aspect_id', aspectId)
        .order('joined_at', { ascending: true })

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch members'
        }
      }

      return {
        success: true,
        data: (members || []) as unknown as SharedAspectMember[]
      }
    } catch (error) {
      console.error('Error fetching aspect members:', error)
      return {
        success: false,
        error: 'Failed to fetch members'
      }
    }
  }

  /**
   * Update shared aspect metadata
   */
  async updateSharedAspect(
    aspectId: string,
    userId: string,
    updates: UpdateSharedAspectDto
  ): Promise<ApiResponse<SharedAspect>> {
    try {
      // Verify userId is owner
      const { data: aspect, error: lookupError } = await this.supabase
        .from('shared_aspects')
        .select('owner_id')
        .eq('id', aspectId)
        .single()

      if (lookupError || !aspect) {
        return {
          success: false,
          error: 'Aspect not found'
        }
      }

      if (aspect.owner_id !== userId) {
        return {
          success: false,
          error: 'Only owners can update aspects'
        }
      }

      // Update aspect
      const { data: updated, error: updateError } = await this.supabase
        .from('shared_aspects')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', aspectId)
        .select()
        .single()

      if (updateError) {
        return {
          success: false,
          error: 'Failed to update aspect'
        }
      }

      return {
        success: true,
        data: updated
      }
    } catch (error) {
      console.error('Error updating shared aspect:', error)
      return {
        success: false,
        error: 'Failed to update aspect'
      }
    }
  }

  /**
   * Delete a shared aspect
   */
  async deleteSharedAspect(aspectId: string, userId: string): Promise<ApiResponse<void>> {
    try {
      // Verify userId is owner
      const { data: aspect, error: lookupError } = await this.supabase
        .from('shared_aspects')
        .select('owner_id')
        .eq('id', aspectId)
        .single()

      if (lookupError || !aspect) {
        return {
          success: false,
          error: 'Aspect not found'
        }
      }

      if (aspect.owner_id !== userId) {
        return {
          success: false,
          error: 'Only owners can delete aspects'
        }
      }

      // Delete aspect (cascade will remove members and unlink events)
      const { error: deleteError } = await this.supabase
        .from('shared_aspects')
        .delete()
        .eq('id', aspectId)

      if (deleteError) {
        return {
          success: false,
          error: 'Failed to delete aspect'
        }
      }

      return {
        success: true
      }
    } catch (error) {
      console.error('Error deleting shared aspect:', error)
      return {
        success: false,
        error: 'Failed to delete aspect'
      }
    }
  }
}
