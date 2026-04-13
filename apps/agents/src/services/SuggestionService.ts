import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseService.js';
import { logger } from '../utils/logger.js';
import type {
  ActionSuggestion,
  PlacementSlot,
  SlotWithSuggestion,
  SlotFeedback,
  CreateSuggestionRequest,
  UpdateSuggestionRequest,
  CreateSlotRequest,
  MoveSlotRequest,
  ResizeSlotRequest,
  ConfirmSlotRequest,
  DismissSlotRequest,
  ListSlotsRequest,
  ListSuggestionsRequest,
  SuggestionStatus,
  FeedbackType,
} from '../types/suggestions.js';

export class SuggestionService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // --- Action Suggestions ---

  async listSuggestions(userId: string, filters?: ListSuggestionsRequest): Promise<ActionSuggestion[]> {
    try {
      // Get archived aspect IDs to exclude
      const { data: archivedAspects } = await this.supabase
        .from('aspects')
        .select('id')
        .eq('user_id', userId)
        .not('archived_at', 'is', null);

      const archivedIds = (archivedAspects || []).map(a => a.id);

      let query = this.supabase
        .from('action_suggestions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.aspect_id) {
        query = query.eq('aspect_id', filters.aspect_id);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('[SuggestionService] Error listing suggestions:', error);
        return [];
      }

      // Filter out suggestions linked to archived aspects
      const filtered = archivedIds.length > 0
        ? (data || []).filter(s => !s.aspect_id || !archivedIds.includes(s.aspect_id))
        : data || [];

      return filtered;
    } catch (error) {
      logger.error('[SuggestionService] Exception listing suggestions:', error);
      return [];
    }
  }

  async createSuggestion(userId: string, input: CreateSuggestionRequest): Promise<ActionSuggestion | null> {
    try {
      // Dedup: reject if a suggestion with a very similar title already exists (any status)
      const { data: existing } = await this.supabase
        .from('action_suggestions')
        .select('id, title, status')
        .eq('user_id', userId)
        .in('status', ['open', 'archived', 'snoozed']);

      if (existing && existing.length > 0) {
        const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const inputNorm = normalise(input.title);
        const duplicate = existing.find(e => {
          const existNorm = normalise(e.title);
          // Exact match after normalisation, or one is a substring of the other (>80% overlap)
          return existNorm === inputNorm
            || (inputNorm.length > 10 && existNorm.includes(inputNorm))
            || (existNorm.length > 10 && inputNorm.includes(existNorm));
        });
        if (duplicate) {
          logger.info(`[SuggestionService] Dedup: skipping "${input.title}" — similar to existing "${duplicate.title}" (${duplicate.status})`);
          return null;
        }
      }

      const { data, error } = await this.supabase
        .from('action_suggestions')
        .insert({
          user_id: userId,
          title: input.title,
          description: input.description,
          suggestion_type: input.suggestion_type,
          source_entity_type: input.source_entity_type,
          source_entity_id: input.source_entity_id,
          aspect_id: input.aspect_id,
          estimated_minutes: input.estimated_minutes,
          energy_level: input.energy_level,
          metadata: input.metadata || {},
        })
        .select()
        .single();

      if (error) {
        logger.error('[SuggestionService] Error creating suggestion:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('[SuggestionService] Exception creating suggestion:', error);
      return null;
    }
  }

  async updateSuggestion(userId: string, input: UpdateSuggestionRequest): Promise<ActionSuggestion | null> {
    try {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.status !== undefined) updates.status = input.status;
      if (input.estimated_minutes !== undefined) updates.estimated_minutes = input.estimated_minutes;
      if (input.energy_level !== undefined) updates.energy_level = input.energy_level;
      if (input.aspect_id !== undefined) updates.aspect_id = input.aspect_id;

      const { data, error } = await this.supabase
        .from('action_suggestions')
        .update(updates)
        .eq('id', input.suggestion_id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('[SuggestionService] Error updating suggestion:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('[SuggestionService] Exception updating suggestion:', error);
      return null;
    }
  }

  // --- Placement Slots ---

  async listSlots(userId: string, filters: ListSlotsRequest): Promise<SlotWithSuggestion[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_slots_with_suggestions', {
          p_user_id: userId,
          p_start_date: filters.start_date,
          p_end_date: filters.end_date,
        });

      if (error) {
        logger.error('[SuggestionService] Error listing slots:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('[SuggestionService] Exception listing slots:', error);
      return [];
    }
  }

  async createSlot(userId: string, input: CreateSlotRequest): Promise<PlacementSlot | null> {
    try {
      // Check for overlap with existing active slots
      const { data: overlapping } = await this.supabase
        .from('placement_slots')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['proposed', 'edited'])
        .lt('start_time', input.end_time)
        .gt('end_time', input.start_time);

      if (overlapping && overlapping.length > 0) {
        logger.warn('[SuggestionService] Slot overlaps with existing active slot, rejecting');
        return null;
      }

      // Check for overlap with calendar events using direct overlap query
      // The RPC get_events_with_aspects uses containment semantics (not overlap),
      // so we query directly with proper overlap logic: event starts before slot ends AND event ends after slot starts
      const { data: overlappingEvents } = await this.supabase
        .from('events')
        .select('id, title, start_time, end_time, is_recurring, recurrence_rule, recurrence_end')
        .eq('user_id', userId)
        .is('parent_event_id', null);

      const slotStartMs = new Date(input.start_time).getTime();
      const slotEndMs = new Date(input.end_time).getTime();

      // Check non-recurring events for direct overlap
      const nonRecurring = (overlappingEvents || []).filter(e => !e.is_recurring);
      const hasNonRecurringOverlap = nonRecurring.some(e => {
        const eStart = new Date(e.start_time).getTime();
        const eEnd = new Date(e.end_time).getTime();
        return eStart < slotEndMs && eEnd > slotStartMs;
      });

      if (hasNonRecurringOverlap) {
        logger.warn('[SuggestionService] Slot overlaps with non-recurring calendar event, rejecting');
        return null;
      }

      // Check recurring events by expanding instances around the slot window
      const recurring = (overlappingEvents || []).filter(e => e.is_recurring && e.recurrence_rule);
      if (recurring.length > 0) {
        try {
          const { expandRecurrenceWithEndTime } = await import('../utils/rrule.js');
          for (const event of recurring) {
            // Expand recurring instances up to the slot end time
            const expandUntil = new Date(slotEndMs + 24 * 60 * 60 * 1000);
            const instances = expandRecurrenceWithEndTime(
              event.recurrence_rule,
              new Date(event.start_time),
              new Date(event.end_time),
              expandUntil
            );
            const recurringOverlap = instances.some((inst: { start: Date; end: Date }) => {
              return inst.start.getTime() < slotEndMs && inst.end.getTime() > slotStartMs;
            });
            if (recurringOverlap) {
              logger.warn(`[SuggestionService] Slot overlaps with recurring event "${event.title}", rejecting`);
              return null;
            }
          }
        } catch (rruleErr) {
          logger.error('[SuggestionService] Error expanding recurrence for overlap check:', rruleErr);
        }
      }

      const { data, error } = await this.supabase
        .from('placement_slots')
        .insert({
          user_id: userId,
          start_time: input.start_time,
          end_time: input.end_time,
          suggestion_id: input.suggestion_id,
          source_agent: input.source_agent,
          reasoning: input.reasoning,
          expires_at: input.expires_at,
        })
        .select()
        .single();

      if (error) {
        logger.error('[SuggestionService] Error creating slot:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('[SuggestionService] Exception creating slot:', error);
      return null;
    }
  }

  async moveSlot(userId: string, input: MoveSlotRequest): Promise<PlacementSlot | null> {
    try {
      const { data, error } = await this.supabase
        .from('placement_slots')
        .update({
          start_time: input.start_time,
          end_time: input.end_time,
          status: 'edited',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.slot_id)
        .eq('user_id', userId)
        .in('status', ['proposed', 'edited'])
        .select()
        .single();

      if (error) {
        logger.error('[SuggestionService] Error moving slot:', error);
        return null;
      }

      await this.recordFeedback(userId, input.slot_id, 'drag');
      return data;
    } catch (error) {
      logger.error('[SuggestionService] Exception moving slot:', error);
      return null;
    }
  }

  async resizeSlot(userId: string, input: ResizeSlotRequest): Promise<PlacementSlot | null> {
    try {
      const { data, error } = await this.supabase
        .from('placement_slots')
        .update({
          end_time: input.end_time,
          status: 'edited',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.slot_id)
        .eq('user_id', userId)
        .in('status', ['proposed', 'edited'])
        .select()
        .single();

      if (error) {
        logger.error('[SuggestionService] Error resizing slot:', error);
        return null;
      }

      await this.recordFeedback(userId, input.slot_id, 'resize');
      return data;
    } catch (error) {
      logger.error('[SuggestionService] Exception resizing slot:', error);
      return null;
    }
  }

  async swapTargeted(userId: string, slotId: string, suggestionId: string): Promise<SlotWithSuggestion | null> {
    try {
      const { data: currentSlot } = await this.supabase
        .from('placement_slots')
        .select('suggestion_id')
        .eq('id', slotId)
        .eq('user_id', userId)
        .in('status', ['proposed', 'edited'])
        .single();

      if (!currentSlot) return null;

      const { error: updateError } = await this.supabase
        .from('placement_slots')
        .update({ suggestion_id: suggestionId, updated_at: new Date().toISOString() })
        .eq('id', slotId)
        .eq('user_id', userId);

      if (updateError) {
        logger.error('[SuggestionService] Error targeted swap:', updateError);
        return null;
      }

      await this.recordFeedback(userId, slotId, 'swap', currentSlot.suggestion_id);

      const { data: updatedSlot } = await this.supabase
        .rpc('get_slots_with_suggestions', {
          p_user_id: userId,
          p_start_date: '1970-01-01T00:00:00Z',
          p_end_date: '2100-01-01T00:00:00Z',
        });

      return (updatedSlot as SlotWithSuggestion[])?.find(s => s.id === slotId) || null;
    } catch (error) {
      logger.error('[SuggestionService] Exception targeted swap:', error);
      return null;
    }
  }

  async swapRandom(userId: string, slotId: string): Promise<SlotWithSuggestion | null> {
    try {
      // Get current slot to know which suggestion to exclude
      const { data: currentSlot, error: slotError } = await this.supabase
        .from('placement_slots')
        .select('suggestion_id')
        .eq('id', slotId)
        .eq('user_id', userId)
        .in('status', ['proposed', 'edited'])
        .single();

      if (slotError || !currentSlot) {
        logger.error('[SuggestionService] Slot not found for swap:', slotError);
        return null;
      }

      // Get suggestion IDs already placed on active slots (to avoid duplicates)
      const { data: activeSlots } = await this.supabase
        .from('placement_slots')
        .select('suggestion_id')
        .eq('user_id', userId)
        .in('status', ['proposed', 'edited']);

      const usedSuggestionIds = new Set(
        (activeSlots || []).map(s => s.suggestion_id).filter(Boolean)
      );

      // Get recently swapped-away suggestions for this slot (avoid cycling)
      const { data: recentFeedback } = await this.supabase
        .from('slot_feedback')
        .select('suggestion_id')
        .eq('user_id', userId)
        .eq('slot_id', slotId)
        .eq('feedback_type', 'swap')
        .order('created_at', { ascending: false })
        .limit(10);

      const recentlySwappedIds = new Set(
        (recentFeedback || []).map(f => f.suggestion_id).filter(Boolean)
      );

      // Get a random open suggestion that isn't on any active slot
      const { data: candidates, error: candidateError } = await this.supabase
        .from('action_suggestions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'open');

      if (candidateError || !candidates || candidates.length === 0) {
        logger.error('[SuggestionService] No alternative suggestions for swap');
        return null;
      }

      // Filter out suggestions on active slots AND recently swapped away from this slot
      const availableCandidates = candidates.filter(c =>
        !usedSuggestionIds.has(c.id) && !recentlySwappedIds.has(c.id)
      );

      // If all candidates were recently swapped, fall back to just excluding active slots
      const finalCandidates = availableCandidates.length > 0
        ? availableCandidates
        : candidates.filter(c => !usedSuggestionIds.has(c.id));

      if (finalCandidates.length === 0) {
        logger.error('[SuggestionService] All open suggestions already placed on slots');
        return null;
      }

      const randomIndex = Math.floor(Math.random() * finalCandidates.length);
      const newSuggestionId = finalCandidates[randomIndex].id;

      // Update slot with new suggestion
      const { error: updateError } = await this.supabase
        .from('placement_slots')
        .update({
          suggestion_id: newSuggestionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', slotId)
        .eq('user_id', userId);

      if (updateError) {
        logger.error('[SuggestionService] Error swapping slot:', updateError);
        return null;
      }

      await this.recordFeedback(userId, slotId, 'swap', currentSlot.suggestion_id);

      // Return updated slot with suggestion details
      const { data: updatedSlot, error: fetchError } = await this.supabase
        .rpc('get_slots_with_suggestions', {
          p_user_id: userId,
          p_start_date: '1970-01-01T00:00:00Z',
          p_end_date: '2100-01-01T00:00:00Z',
        });

      if (fetchError || !updatedSlot) return null;

      return (updatedSlot as SlotWithSuggestion[]).find(s => s.id === slotId) || null;
    } catch (error) {
      logger.error('[SuggestionService] Exception swapping slot:', error);
      return null;
    }
  }

  async confirmSlot(userId: string, slotId: string): Promise<{ event_id: string; slot: PlacementSlot } | null> {
    try {
      // Get slot with suggestion details
      const { data: slot, error: slotError } = await this.supabase
        .from('placement_slots')
        .select('*, action_suggestions(*)')
        .eq('id', slotId)
        .eq('user_id', userId)
        .in('status', ['proposed', 'edited'])
        .single();

      if (slotError || !slot) {
        logger.error('[SuggestionService] Slot not found for confirm:', slotError);
        return null;
      }

      const suggestion = slot.action_suggestions;

      // Create real event from slot
      const { data: event, error: eventError } = await this.supabase
        .from('events')
        .insert({
          user_id: userId,
          title: suggestion.title,
          description: suggestion.description,
          start_time: slot.start_time,
          end_time: slot.end_time,
          aspect_id: suggestion.aspect_id,
        })
        .select()
        .single();

      if (eventError || !event) {
        logger.error('[SuggestionService] Error creating event from slot:', eventError);
        return null;
      }

      // Update slot status
      const { data: updatedSlot, error: updateError } = await this.supabase
        .from('placement_slots')
        .update({
          status: 'confirmed',
          confirmed_event_id: event.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', slotId)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        logger.error('[SuggestionService] Error updating slot after confirm:', updateError);
      }

      // Mark suggestion as completed
      await this.supabase
        .from('action_suggestions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', suggestion.id)
        .eq('user_id', userId);

      await this.recordFeedback(userId, slotId, 'confirm', suggestion.id);

      return { event_id: event.id, slot: updatedSlot || slot };
    } catch (error) {
      logger.error('[SuggestionService] Exception confirming slot:', error);
      return null;
    }
  }

  async dismissSlot(userId: string, slotId: string, reason?: string): Promise<PlacementSlot | null> {
    try {
      const { data: slot, error: slotError } = await this.supabase
        .from('placement_slots')
        .select('suggestion_id')
        .eq('id', slotId)
        .eq('user_id', userId)
        .in('status', ['proposed', 'edited'])
        .single();

      if (slotError || !slot) {
        logger.error('[SuggestionService] Slot not found for dismiss:', slotError);
        return null;
      }

      const { data, error } = await this.supabase
        .from('placement_slots')
        .update({
          status: 'dismissed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', slotId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('[SuggestionService] Error dismissing slot:', error);
        return null;
      }

      await this.recordFeedback(userId, slotId, 'dismiss', slot.suggestion_id, reason);

      // Archive the suggestion so it never comes back
      await this.supabase
        .from('action_suggestions')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', slot.suggestion_id)
        .eq('user_id', userId);

      // Also dismiss any other slots using the same suggestion
      await this.supabase
        .from('placement_slots')
        .update({ status: 'dismissed', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('suggestion_id', slot.suggestion_id)
        .in('status', ['proposed', 'edited']);

      return data;
    } catch (error) {
      logger.error('[SuggestionService] Exception dismissing slot:', error);
      return null;
    }
  }

  // --- Feedback ---

  private async recordFeedback(
    userId: string,
    slotId: string,
    feedbackType: FeedbackType,
    suggestionId?: string,
    reason?: string,
  ): Promise<void> {
    try {
      await this.supabase
        .from('slot_feedback')
        .insert({
          user_id: userId,
          slot_id: slotId,
          suggestion_id: suggestionId,
          feedback_type: feedbackType,
          reason,
        });
    } catch (error) {
      logger.error('[SuggestionService] Error recording feedback:', error);
    }
  }

  // --- Helpers ---

  async getOpenSuggestionCount(userId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('action_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'open');

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Lightweight slot replenishment — no LLM call.
   * Picks unused suggestions from the backlog and finds free time windows via DB queries.
   * Returns the number of new slots created.
   */
  /**
   * Expire stale slots before any replenishment.
   * Marks slots as expired if their end_time or expires_at is in the past.
   */
  private async expireStaleSlots(userId: string): Promise<number> {
    const now = new Date().toISOString();
    const { data: stale } = await this.supabase
      .from('placement_slots')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['proposed', 'edited'])
      .or(`expires_at.lt.${now},end_time.lt.${now}`);

    if (!stale || stale.length === 0) return 0;

    await this.supabase
      .from('placement_slots')
      .update({ status: 'expired', updated_at: now })
      .in('id', stale.map(s => s.id));

    logger.info(`[SuggestionService] Expired ${stale.length} stale slots for user ${userId}`);
    return stale.length;
  }

  /**
   * Lightweight slot replenishment — no LLM call.
   * Places ALL unused suggestions into free time windows.
   * Frontend controls how many to show (4 at a time).
   */
  async replenishSlotsLightweight(userId: string): Promise<number> {
    try {
      // Expire stale slots first so they don't block new placements
      await this.expireStaleSlots(userId);

      // Get IDs already on active slots
      const { data: activeSlots } = await this.supabase
        .from('placement_slots')
        .select('suggestion_id, start_time, end_time')
        .eq('user_id', userId)
        .in('status', ['proposed', 'edited']);

      const usedIds = new Set((activeSlots || []).map(s => s.suggestion_id));

      // Get open suggestions not already placed
      const { data: candidates } = await this.supabase
        .from('action_suggestions')
        .select('id, title, estimated_minutes, energy_level')
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('created_at', { ascending: true });

      const available = (candidates || []).filter(c => !usedIds.has(c.id));
      if (available.length === 0) {
        logger.warn('[SuggestionService] No unused suggestions for replenishment');
        return 0;
      }

      // Get user's timezone and compute UTC offset
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('timezone')
        .eq('user_id', userId)
        .single();
      const userTz = profile?.timezone || 'America/Los_Angeles';

      // Compute offset: difference between UTC and user's local time
      // e.g., Pacific (UTC-7) means we need to ADD 7 hours to local times to get UTC
      const now = new Date();
      const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
      const localStr = now.toLocaleString('en-US', { timeZone: userTz });
      const tzOffsetMs = new Date(utcStr).getTime() - new Date(localStr).getTime();

      const weekEnd = new Date(now.getTime() + 7 * 86400000);

      const { data: events } = await this.supabase
        .from('events')
        .select('start_time, end_time')
        .eq('user_id', userId)
        .gte('end_time', now.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .order('start_time', { ascending: true });

      // Build list of busy intervals (events + existing slots)
      const busy: Array<{ start: number; end: number }> = [];
      for (const e of (events || [])) {
        busy.push({ start: new Date(e.start_time).getTime(), end: new Date(e.end_time).getTime() });
      }
      for (const s of (activeSlots || [])) {
        busy.push({ start: new Date(s.start_time).getTime(), end: new Date(s.end_time).getTime() });
      }
      busy.sort((a, b) => a.start - b.start);

      // Find free windows: scan day by day, 8 AM - 9 PM, 60-min slots, 30-min gap from busy
      const maxSlots = available.length;
      const freeWindows: Array<{ start: Date; end: Date }> = [];
      const GAP = 30 * 60 * 1000; // 30 min buffer
      const SLOT_DURATION = 60 * 60 * 1000; // 60 min

      for (let dayOffset = 0; dayOffset < 7 && freeWindows.length < maxSlots; dayOffset++) {
        const day = new Date(now);
        day.setDate(day.getDate() + dayOffset);

        // Scan from 9 AM to 9 PM in user's LOCAL time (converted to UTC)
        for (let hour = 9; hour <= 20 && freeWindows.length < maxSlots; hour++) {
          for (const min of [0, 30]) {
            if (freeWindows.length >= maxSlots) break;
            // Set hour in UTC, then add timezone offset to convert from local -> UTC
            const slotStart = new Date(day);
            slotStart.setUTCHours(hour, min, 0, 0);
            // Add offset: if Pacific is UTC-7, tzOffsetMs is +7h, so 9AM local = 9+7 = 16:00 UTC
            const slotStartUtc = new Date(slotStart.getTime() + tzOffsetMs);
            const slotEnd = new Date(slotStartUtc.getTime() + SLOT_DURATION);

            // Skip if in the past
            if (slotStartUtc.getTime() < now.getTime()) continue;

            // Check overlap with any busy interval (including gap buffer)
            const hasConflict = busy.some(b =>
              slotStartUtc.getTime() < (b.end + GAP) && slotEnd.getTime() > (b.start - GAP)
            );

            if (!hasConflict) {
              // Also check against windows we just picked
              const selfConflict = freeWindows.some(w =>
                slotStartUtc.getTime() < (w.end.getTime() + GAP) && slotEnd.getTime() > (w.start.getTime() - GAP)
              );
              if (!selfConflict) {
                freeWindows.push({ start: slotStartUtc, end: slotEnd });
              }
            }
          }
        }
      }

      // Place slots for all available suggestions
      let created = 0;
      for (let i = 0; i < Math.min(freeWindows.length, available.length); i++) {
        const suggestion = available[i];
        const window = freeWindows[i];

        const slot = await this.createSlot(userId, {
          start_time: window.start.toISOString(),
          end_time: window.end.toISOString(),
          suggestion_id: suggestion.id,
          source_agent: 'scheduler-lite',
          reasoning: `Auto-placed in free window`,
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });

        if (slot) {
          created++;
          // Add to busy so next iteration avoids it
          busy.push({ start: window.start.getTime(), end: window.end.getTime() });
        }
      }

      logger.info(`[SuggestionService] Lightweight replenish: created ${created} slots for user ${userId}`);
      return created;
    } catch (error) {
      logger.error('[SuggestionService] Error in lightweight replenish:', error);
      return 0;
    }
  }

  async getActiveSlotCount(userId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('placement_slots')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['proposed', 'edited']);

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }
}
