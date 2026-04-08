import { Request, Response } from 'express';
import { getSupabaseService, getSupabaseClient } from '../services/SupabaseService.js';

export interface InboxItem {
  id: string
  type: 'interaction' | 'event_invite' | 'friend_request' | 'aspect_invite'
  title: string
  subtitle?: string
  created_at: string
  // Interaction fields
  interaction_type?: string
  options?: string[]
  priority?: number
  aspect?: { id: string; name: string; color: string; icon?: string } | null
  metadata?: Record<string, any>
  // Event invite fields
  event_id?: string
  event?: { title: string; start_time: string; end_time: string; location?: string }
  inviter_name?: string
  role?: 'member' | 'viewer'
  // Friend request fields
  friendship_id?: string
  requester?: { id: string; name: string; avatar_url?: string }
  // Aspect invite fields
  aspect_id?: string
  owner_name?: string
}

export async function getInboxItems(req: Request, res: Response): Promise<Response | void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const items: InboxItem[] = [];

    // 1. Fetch pending interactions (exclude time_suggestion and rating types)
    const supabaseService = getSupabaseService();
    const pendingInteractions = await supabaseService.getPendingUserInteractions(userId, 'interaction');
    const filteredInteractions = pendingInteractions.filter(
      (i: any) => !['time_suggestion', 'rating'].includes(i.interaction_type || i.type)
    );

    for (const interaction of filteredInteractions) {
      items.push({
        id: interaction.id,
        type: 'interaction',
        title: interaction.question,
        created_at: interaction.created_at,
        interaction_type: interaction.interaction_type || interaction.type,
        options: interaction.options,
        priority: interaction.priority,
        aspect: interaction.aspect || null,
        metadata: interaction.metadata,
      });
    }

    // 2. Fetch pending event invites (multi-step to avoid FK join issues)
    const supabase = getSupabaseClient();
    const { data: pendingInvites } = await supabase
      .from('event_members')
      .select('id, event_id, role, joined_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('joined_at', { ascending: false });

    if (pendingInvites && pendingInvites.length > 0) {
      // Fetch event details
      const eventIds = pendingInvites.map(i => i.event_id);
      const { data: events } = await supabase
        .from('events')
        .select('id, title, start_time, end_time, location, user_id')
        .in('id', eventIds);

      const eventMap: Record<string, any> = {};
      const inviterIds = new Set<string>();
      if (events) {
        for (const e of events) {
          eventMap[e.id] = e;
          inviterIds.add(e.user_id);
        }
      }

      // Fetch inviter profiles
      const inviterProfiles: Record<string, { display_name: string; avatar_url?: string }> = {};
      if (inviterIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profile')
          .select('id, display_name, avatar_url')
          .in('id', Array.from(inviterIds));

        if (profiles) {
          for (const p of profiles) {
            inviterProfiles[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
          }
        }
      }

      for (const invite of pendingInvites) {
        const event = eventMap[invite.event_id];
        if (!event) continue;

        const inviterProfile = inviterProfiles[event.user_id];
        const inviterName = inviterProfile?.display_name || 'Someone';

        items.push({
          id: invite.id,
          type: 'event_invite',
          title: `${inviterName} invited you to "${event.title}"`,
          subtitle: event.start_time ? new Date(event.start_time).toLocaleString() : undefined,
          created_at: invite.joined_at,
          event_id: invite.event_id,
          event: {
            title: event.title,
            start_time: event.start_time,
            end_time: event.end_time,
            location: event.location,
          },
          inviter_name: inviterName,
          role: invite.role as 'member' | 'viewer',
        });
      }
    }

    // 3. Fetch pending friend requests (two-step: friendships then profiles)
    const { data: pendingRequests } = await supabase
      .from('user_friendships')
      .select('id, requester_id, created_at')
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (pendingRequests && pendingRequests.length > 0) {
      const requesterIds = pendingRequests.map(r => r.requester_id);
      const { data: requesterProfiles } = await supabase
        .from('profile')
        .select('id, display_name, avatar_url')
        .in('id', requesterIds);

      const profileMap: Record<string, { display_name: string; avatar_url?: string }> = {};
      if (requesterProfiles) {
        for (const p of requesterProfiles) {
          profileMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        }
      }

      for (const request of pendingRequests) {
        const profile = profileMap[request.requester_id];
        const requesterName = profile?.display_name || 'Someone';

        items.push({
          id: request.id,
          type: 'friend_request',
          title: `${requesterName} sent you a friend request`,
          created_at: request.created_at,
          friendship_id: request.id,
          requester: {
            id: request.requester_id,
            name: requesterName,
            avatar_url: profile?.avatar_url,
          },
        });
      }
    }

    // 4. Fetch pending aspect invites
    const { data: pendingAspectInvites } = await supabase
      .from('aspect_members')
      .select('id, aspect_id, role, joined_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('joined_at', { ascending: false });

    if (pendingAspectInvites && pendingAspectInvites.length > 0) {
      const aspectIds = pendingAspectInvites.map(i => i.aspect_id);
      const { data: aspects } = await supabase
        .from('aspects')
        .select('id, name, color, icon, user_id')
        .in('id', aspectIds);

      const aspectMap: Record<string, any> = {};
      const ownerIds = new Set<string>();
      if (aspects) {
        for (const a of aspects) {
          aspectMap[a.id] = a;
          ownerIds.add(a.user_id);
        }
      }

      const ownerProfiles: Record<string, { display_name: string }> = {};
      if (ownerIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profile')
          .select('id, display_name')
          .in('id', Array.from(ownerIds));

        if (profiles) {
          for (const p of profiles) {
            ownerProfiles[p.id] = { display_name: p.display_name };
          }
        }
      }

      for (const invite of pendingAspectInvites) {
        const aspect = aspectMap[invite.aspect_id];
        if (!aspect) continue;

        const ownerProfile = ownerProfiles[aspect.user_id];
        const ownerName = ownerProfile?.display_name || 'Someone';

        items.push({
          id: invite.id,
          type: 'aspect_invite',
          title: `${ownerName} invited you to the "${aspect.name}" aspect`,
          created_at: invite.joined_at,
          aspect_id: invite.aspect_id,
          aspect: {
            id: aspect.id,
            name: aspect.name,
            color: aspect.color,
            icon: aspect.icon,
          },
          owner_name: ownerName,
          role: invite.role as 'member' | 'viewer',
        });
      }
    }

    // Sort all items by created_at descending
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return res.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error('Error fetching inbox items:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
