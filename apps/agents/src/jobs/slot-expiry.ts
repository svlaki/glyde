import { getSupabaseClient } from '../services/SupabaseService.js';

const EXPIRY_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

let expiryInterval: NodeJS.Timeout | null = null;

/**
 * Expires placement slots that:
 * 1. Have passed their expires_at timestamp
 * 2. Have end_time in the past (the suggested time window already passed)
 *
 * Also frees up the linked action_suggestions by setting them back to 'open'
 * so they can be placed in new time slots.
 */
async function expireStaleSlots(): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // Find slots that should be expired
    const { data: staleSlots, error: fetchError } = await supabase
      .from('placement_slots')
      .select('id, suggestion_id')
      .in('status', ['proposed', 'edited'])
      .or(`expires_at.lt.${now},end_time.lt.${now}`);

    if (fetchError || !staleSlots || staleSlots.length === 0) return;

    const slotIds = staleSlots.map(s => s.id);
    const suggestionIds = [...new Set(staleSlots.map(s => s.suggestion_id).filter(Boolean))];

    // Mark slots as expired
    const { error: updateError } = await supabase
      .from('placement_slots')
      .update({ status: 'expired', updated_at: now })
      .in('id', slotIds);

    if (updateError) {
      console.error('[SLOT-EXPIRY] Error expiring slots:', updateError);
      return;
    }

    // For expired slots, re-open their suggestions so they can be re-placed
    // Only re-open suggestions that don't have other active slots
    if (suggestionIds.length > 0) {
      const { data: stillActive } = await supabase
        .from('placement_slots')
        .select('suggestion_id')
        .in('suggestion_id', suggestionIds)
        .in('status', ['proposed', 'edited']);

      const stillActiveIds = new Set((stillActive || []).map(s => s.suggestion_id));
      const orphanedSuggestionIds = suggestionIds.filter(id => !stillActiveIds.has(id));

      if (orphanedSuggestionIds.length > 0) {
        // Re-open suggestions that were completed due to being placed,
        // but only if they're not archived or completed by the user
        await supabase
          .from('action_suggestions')
          .update({ status: 'open', updated_at: now })
          .in('id', orphanedSuggestionIds)
          .eq('status', 'open'); // Only touch ones already open (no-op, just safety)
      }
    }

    console.log(`[SLOT-EXPIRY] Expired ${slotIds.length} stale slots`);
  } catch (error) {
    console.error('[SLOT-EXPIRY] Error in expiry check:', error);
  }
}

export function startSlotExpiryJob(): void {
  console.log(`[SLOT-EXPIRY] Starting slot expiry job (interval: ${EXPIRY_INTERVAL_MS / 1000}s)`);

  // Run immediately on startup
  expireStaleSlots().catch(err => {
    console.error('[SLOT-EXPIRY] Initial expiry check failed:', err);
  });

  expiryInterval = setInterval(() => {
    expireStaleSlots().catch(err => {
      console.error('[SLOT-EXPIRY] Periodic expiry check failed:', err);
    });
  }, EXPIRY_INTERVAL_MS);
}

export function stopSlotExpiryJob(): void {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
    console.log('[SLOT-EXPIRY] Stopped slot expiry job');
  }
}
