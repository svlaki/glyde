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

  async createSharedAspect(
    ownerId: string,
    data: CreateSharedAspectDto
  ): Promise<ApiResponse<SharedAspect>> {
    try {
      const { data: aspect, error: createError } = await this.supabase
        .from('aspects')
        .insert({
          user_id: ownerId,
          name: data.name,
          color: data.color || '#3b82f6',
          description: data.description || null,
          icon: data.icon || null,
          visibility: 'shared'
        })
        .select()
        .single()

      if (createError || !aspect) {
        return {
          success: false,
          error: 'Failed to create shared aspect'
        }
      }

      const { error: memberError } = await this.supabase
        .from('aspect_members')
        .insert({
          aspect_id: aspect.id,
          user_id: ownerId,
          role: 'owner'
        })

      if (memberError) {
        await this.supabase
          .from('aspects')
          .delete()
          .eq('id', aspect.id)

        return {
          success: false,
          error: 'Failed to initialize aspect'
        }
      }

      const response: SharedAspect = {
        id: aspect.id,
        name: aspect.name,
        description: aspect.description,
        color: aspect.color,
        icon: aspect.icon,
        owner_id: aspect.user_id,
        created_at: aspect.created_at,
        updated_at: aspect.updated_at
      }

      return {
        success: true,
        data: response
      }
    } catch (error) {
      console.error('Error creating shared aspect:', error)
      return {
        success: false,
        error: 'Failed to create shared aspect'
      }
    }
  }

  async addMember(
    aspectId: string,
    userId: string,
    invitedUserId: string,
    role: 'editor' | 'viewer'
  ): Promise<ApiResponse<SharedAspectMember>> {
    try {
      const { data: userMember, error: memberCheckError } = await this.supabase
        .from('aspect_members')
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

      const friendshipService = new FriendshipService(this.supabase)
      const areFriends = await friendshipService.areFriends(userId, invitedUserId)
      if (!areFriends) {
        return {
          success: false,
          error: 'You can only add friends to shared aspects'
        }
      }

      const { data: existingMember } = await this.supabase
        .from('aspect_members')
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

      const { data: newMember, error: insertError } = await this.supabase
        .from('aspect_members')
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

  async updateMemberRole(
    aspectId: string,
    userId: string,
    memberId: string,
    newRole: 'editor' | 'viewer'
  ): Promise<ApiResponse<SharedAspectMember>> {
    try {
      const { data: userMember, error: ownerCheckError } = await this.supabase
        .from('aspect_members')
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

      const { data: member, error: memberError } = await this.supabase
        .from('aspect_members')
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

      if (member.role === 'owner') {
        return {
          success: false,
          error: 'Cannot change owner role'
        }
      }

      const { data: updated, error: updateError } = await this.supabase
        .from('aspect_members')
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

  async removeMember(
    aspectId: string,
    userId: string,
    memberId: string
  ): Promise<ApiResponse<void>> {
    try {
      const { data: userMember, error: ownerCheckError } = await this.supabase
        .from('aspect_members')
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

      const { data: member, error: memberError } = await this.supabase
        .from('aspect_members')
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

      if (member.role === 'owner') {
        return {
          success: false,
          error: 'Cannot remove the owner from aspect'
        }
      }

      const { error: deleteError } = await this.supabase
        .from('aspect_members')
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

  async getUserSharedAspects(userId: string): Promise<ApiResponse<SharedAspect[]>> {
    try {
      const { data: memberRows, error: memberError } = await this.supabase
        .from('aspect_members')
        .select('aspect_id')
        .eq('user_id', userId)

      if (memberError) {
        return {
          success: false,
          error: 'Failed to fetch shared aspects'
        }
      }

      const aspectIds = (memberRows || []).map(r => r.aspect_id)

      if (aspectIds.length === 0) {
        return {
          success: true,
          data: []
        }
      }

      const { data: aspects, error } = await this.supabase
        .from('aspects')
        .select('*')
        .in('id', aspectIds)
        .eq('visibility', 'shared')
        .order('created_at', { ascending: false })

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch shared aspects'
        }
      }

      const mapped: SharedAspect[] = (aspects || []).map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        color: a.color,
        icon: a.icon,
        owner_id: a.user_id,
        created_at: a.created_at,
        updated_at: a.updated_at
      }))

      return {
        success: true,
        data: mapped
      }
    } catch (error) {
      console.error('Error fetching user shared aspects:', error)
      return {
        success: false,
        error: 'Failed to fetch shared aspects'
      }
    }
  }

  async getAspectMembers(
    aspectId: string,
    userId: string
  ): Promise<ApiResponse<SharedAspectMember[]>> {
    try {
      const { data: userAccess } = await this.supabase
        .from('aspect_members')
        .select('id')
        .eq('aspect_id', aspectId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!userAccess) {
        const { data: aspect } = await this.supabase
          .from('aspects')
          .select('user_id')
          .eq('id', aspectId)
          .single()

        if (!aspect || aspect.user_id !== userId) {
          return {
            success: false,
            error: 'You do not have access to this aspect'
          }
        }
      }

      const { data: members, error } = await this.supabase
        .from('aspect_members')
        .select(
          `
          id,
          aspect_id,
          user_id,
          role,
          joined_at,
          user:profile!aspect_members_profile_fkey(id, email, display_name, avatar_url)
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

  async updateSharedAspect(
    aspectId: string,
    userId: string,
    updates: UpdateSharedAspectDto
  ): Promise<ApiResponse<SharedAspect>> {
    try {
      const { data: aspect, error: lookupError } = await this.supabase
        .from('aspects')
        .select('user_id')
        .eq('id', aspectId)
        .eq('visibility', 'shared')
        .single()

      if (lookupError || !aspect) {
        return {
          success: false,
          error: 'Aspect not found'
        }
      }

      if (aspect.user_id !== userId) {
        return {
          success: false,
          error: 'Only owners can update aspects'
        }
      }

      const { data: updated, error: updateError } = await this.supabase
        .from('aspects')
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

      const response: SharedAspect = {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        color: updated.color,
        icon: updated.icon,
        owner_id: updated.user_id,
        created_at: updated.created_at,
        updated_at: updated.updated_at
      }

      return {
        success: true,
        data: response
      }
    } catch (error) {
      console.error('Error updating shared aspect:', error)
      return {
        success: false,
        error: 'Failed to update aspect'
      }
    }
  }

  async deleteSharedAspect(aspectId: string, userId: string): Promise<ApiResponse<void>> {
    try {
      const { data: aspect, error: lookupError } = await this.supabase
        .from('aspects')
        .select('user_id')
        .eq('id', aspectId)
        .eq('visibility', 'shared')
        .single()

      if (lookupError || !aspect) {
        return {
          success: false,
          error: 'Aspect not found'
        }
      }

      if (aspect.user_id !== userId) {
        return {
          success: false,
          error: 'Only owners can delete aspects'
        }
      }

      const { error: deleteError } = await this.supabase
        .from('aspects')
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
