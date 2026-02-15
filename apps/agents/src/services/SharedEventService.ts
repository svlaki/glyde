import { SupabaseClient } from '@supabase/supabase-js'
import { ApiResponse } from '../types/api.js'
import { FriendshipService } from './FriendshipService.js'

export interface SharedEventMember {
  id: string
  event_id: string
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

export class SharedEventService {
  constructor(private supabase: SupabaseClient) {}

  async addMember(
    eventId: string,
    userId: string,
    invitedUserId: string,
    role: 'editor' | 'viewer'
  ): Promise<ApiResponse<SharedEventMember>> {
    try {
      // Verify event exists and user is owner or editor
      const { data: event, error: eventError } = await this.supabase
        .from('events')
        .select('user_id, visibility')
        .eq('id', eventId)
        .single()

      if (eventError || !event) {
        return { success: false, error: 'Event not found' }
      }

      const isOwner = event.user_id === userId
      if (!isOwner) {
        const { data: userMember } = await this.supabase
          .from('event_members')
          .select('role')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .single()

        if (!userMember || (userMember.role !== 'owner' && userMember.role !== 'editor')) {
          return { success: false, error: 'You do not have permission to add members' }
        }
      }

      // Verify friendship
      const friendshipService = new FriendshipService(this.supabase)
      const areFriends = await friendshipService.areFriends(userId, invitedUserId)
      if (!areFriends) {
        return { success: false, error: 'You can only add friends to shared events' }
      }

      // Check not already a member
      const { data: existingMember } = await this.supabase
        .from('event_members')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', invitedUserId)
        .maybeSingle()

      if (existingMember) {
        return { success: false, error: 'User is already a member of this event' }
      }

      // Set event visibility to shared if not already
      if (event.visibility !== 'shared') {
        await this.supabase
          .from('events')
          .update({ visibility: 'shared' })
          .eq('id', eventId)
      }

      // Add owner as member if not already (first time sharing)
      if (isOwner) {
        const { data: ownerMember } = await this.supabase
          .from('event_members')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .maybeSingle()

        if (!ownerMember) {
          await this.supabase
            .from('event_members')
            .insert({ event_id: eventId, user_id: userId, role: 'owner' })
        }
      }

      // Insert member
      const { data: newMember, error: insertError } = await this.supabase
        .from('event_members')
        .insert({ event_id: eventId, user_id: invitedUserId, role })
        .select()
        .single()

      if (insertError || !newMember) {
        return { success: false, error: 'Failed to add member' }
      }

      return { success: true, data: newMember }
    } catch (error) {
      console.error('Error adding event member:', error)
      return { success: false, error: 'Failed to add member' }
    }
  }

  async updateMemberRole(
    eventId: string,
    userId: string,
    memberId: string,
    newRole: 'editor' | 'viewer'
  ): Promise<ApiResponse<SharedEventMember>> {
    try {
      // Only owner can change roles
      const { data: event } = await this.supabase
        .from('events')
        .select('user_id')
        .eq('id', eventId)
        .single()

      if (!event || event.user_id !== userId) {
        return { success: false, error: 'Only the event owner can change member roles' }
      }

      // Get the member
      const { data: member, error: memberError } = await this.supabase
        .from('event_members')
        .select('*')
        .eq('id', memberId)
        .eq('event_id', eventId)
        .single()

      if (memberError || !member) {
        return { success: false, error: 'Member not found' }
      }

      if (member.role === 'owner') {
        return { success: false, error: 'Cannot change owner role' }
      }

      const { data: updated, error: updateError } = await this.supabase
        .from('event_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .select()
        .single()

      if (updateError) {
        return { success: false, error: 'Failed to update member role' }
      }

      return { success: true, data: updated }
    } catch (error) {
      console.error('Error updating event member role:', error)
      return { success: false, error: 'Failed to update member role' }
    }
  }

  async removeMember(
    eventId: string,
    userId: string,
    memberId: string
  ): Promise<ApiResponse<void>> {
    try {
      // Only owner can remove members
      const { data: event } = await this.supabase
        .from('events')
        .select('user_id')
        .eq('id', eventId)
        .single()

      if (!event || event.user_id !== userId) {
        return { success: false, error: 'Only the event owner can remove members' }
      }

      const { data: member } = await this.supabase
        .from('event_members')
        .select('role')
        .eq('id', memberId)
        .eq('event_id', eventId)
        .single()

      if (!member) {
        return { success: false, error: 'Member not found' }
      }

      if (member.role === 'owner') {
        return { success: false, error: 'Cannot remove the owner from event' }
      }

      const { error: deleteError } = await this.supabase
        .from('event_members')
        .delete()
        .eq('id', memberId)

      if (deleteError) {
        return { success: false, error: 'Failed to remove member' }
      }

      // If no non-owner members left, revert to private
      const { data: remaining } = await this.supabase
        .from('event_members')
        .select('id')
        .eq('event_id', eventId)
        .neq('role', 'owner')

      if (!remaining || remaining.length === 0) {
        // Remove owner member record and set visibility back to private
        await this.supabase
          .from('event_members')
          .delete()
          .eq('event_id', eventId)
          .eq('role', 'owner')

        await this.supabase
          .from('events')
          .update({ visibility: 'private' })
          .eq('id', eventId)
      }

      return { success: true }
    } catch (error) {
      console.error('Error removing event member:', error)
      return { success: false, error: 'Failed to remove member' }
    }
  }

  async getEventMembers(
    eventId: string,
    userId: string
  ): Promise<ApiResponse<SharedEventMember[]>> {
    try {
      // Verify user has access (owner or member)
      const { data: event } = await this.supabase
        .from('events')
        .select('user_id')
        .eq('id', eventId)
        .single()

      if (!event) {
        return { success: false, error: 'Event not found' }
      }

      const isOwner = event.user_id === userId
      if (!isOwner) {
        const { data: userMember } = await this.supabase
          .from('event_members')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .maybeSingle()

        if (!userMember) {
          return { success: false, error: 'You do not have access to this event' }
        }
      }

      const { data: members, error } = await this.supabase
        .from('event_members')
        .select(`
          id,
          event_id,
          user_id,
          role,
          joined_at,
          user:profile!event_members_profile_fkey(id, email, display_name, avatar_url)
        `)
        .eq('event_id', eventId)
        .order('joined_at', { ascending: true })

      if (error) {
        return { success: false, error: 'Failed to fetch members' }
      }

      return {
        success: true,
        data: (members || []) as unknown as SharedEventMember[]
      }
    } catch (error) {
      console.error('Error fetching event members:', error)
      return { success: false, error: 'Failed to fetch members' }
    }
  }
}
