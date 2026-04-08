import { Request, Response } from 'express';

import { getSupabaseService } from '../services/SupabaseService.js';
import reminderService from '../services/ReminderService.js';

export async function getPendingInteractions(req: Request, res: Response): Promise<Response | void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseService = getSupabaseService();

    // Just fetch existing pending interactions - do NOT generate new ones
    // Generation should only happen via triggerProactiveAgent (manual refresh button)
    const pending = await supabaseService.getPendingUserInteractions(userId, 'interaction');

    return res.json({
      success: true,
      interactions: pending
    });
  } catch (error) {
    console.error('Error getting pending interactions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function respondToInteraction(req: Request, res: Response): Promise<Response | void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { interaction_id: interactionId, response } = req.body ?? {};

    console.log(`[INTERACTION RESPONSE] User ${userId} responded to interaction ${interactionId} with: "${response}"`);

    if (!interactionId || typeof response !== 'string' || response.trim().length === 0) {
      return res.status(400).json({ error: 'interaction_id and response are required' });
    }

    const supabaseService = getSupabaseService();
    const trimmedResponse = response.trim();

    // Get the interaction
    const interaction = await supabaseService.getUserInteractionById(interactionId);
    if (!interaction) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    // DISMISS PATH: If user dismissed, just cancel it
    if (trimmedResponse === 'dismissed') {
      console.log(`[INTERACTION RESPONSE] User dismissed interaction ${interactionId}`);
      await supabaseService.updateInteractionStatus(interactionId, 'cancelled');
      return res.json({ success: true, message: 'Interaction dismissed' });
    }

    // DECLINE PATH: If user said no/skip/decline, cancel without routing to Gerald
    // Gerald ignores "do nothing" instructions and creates things anyway, so we short-circuit here
    const declinePatterns = /^(no|no thanks|nah|skip|not now|no,|nope|not today|pass|dismiss|cancel)/i;
    if (declinePatterns.test(trimmedResponse)) {
      console.log(`[INTERACTION RESPONSE] User declined interaction ${interactionId}: "${trimmedResponse}"`);
      await supabaseService.saveInteractionResponse(userId, interactionId, trimmedResponse);
      await supabaseService.updateInteractionStatus(interactionId, 'responded');
      return res.json({ success: true, message: 'Response recorded' });
    }

    // Save the response to database
    const saved = await supabaseService.saveInteractionResponse(userId, interactionId, trimmedResponse);
    if (!saved) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    // Auto-store rating scores — do NOT route to Gerald (it would create a duplicate)
    if (interaction.interaction_type === 'rating') {
      const score = parseInt(trimmedResponse, 10);
      if (!isNaN(score) && score >= 1 && score <= 10) {
        const meta = (interaction.metadata || {}) as any;
        const ratingTopic = meta.ratingTopic || interaction.question;
        try {
          await supabaseService.createRating(userId, {
            topic: ratingTopic,
            score,
            description: meta.ratingDescription,
            aspectId: interaction.aspect_id || meta.aspectId,
          });
          console.log(`[INTERACTION RESPONSE] Rating stored: "${ratingTopic}" = ${score}/10`);
        } catch (ratingError) {
          console.error(`[INTERACTION RESPONSE] Failed to store rating:`, ratingError);
        }
      } else {
        console.warn(`[INTERACTION RESPONSE] Invalid rating score from response: "${trimmedResponse}"`);
      }
      // Short-circuit — rating is stored, no need for Gerald to process
      return res.json({ success: true, message: 'Rating recorded' });
    }

    // Handle reminder-specific responses (snooze/acknowledge)
    const interactionMeta = (interaction.metadata || {}) as any;
    if (interactionMeta.context === 'reminder_delivery' && interactionMeta.reminderId) {
      const reminderId = interactionMeta.reminderId;
      if (trimmedResponse === 'Got it') {
        await reminderService.deleteReminder(userId, reminderId);
      } else if (trimmedResponse === 'Snooze 15min') {
        const snoozeUntil = new Date(Date.now() + 15 * 60000).toISOString();
        await reminderService.snoozeReminder(userId, reminderId, snoozeUntil);
      } else if (trimmedResponse === 'Snooze 1hr') {
        const snoozeUntil = new Date(Date.now() + 60 * 60000).toISOString();
        await reminderService.snoozeReminder(userId, reminderId, snoozeUntil);
      } else if (trimmedResponse === 'Snooze tomorrow') {
        const now = new Date();
        const tomorrowAt9 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
        await reminderService.snoozeReminder(userId, reminderId, tomorrowAt9.toISOString());
      }

      // Reminder responses are self-contained - no need to route to Gerald
      // Response already saved above (line 72), just update status
      await supabaseService.updateInteractionStatus(interactionId, 'responded');
      return res.json({ success: true, message: 'Reminder response processed' });
    }

    // Mark interaction as responded (not cancelled - that's for dismissals)
    await supabaseService.updateInteractionStatus(interactionId, 'responded');

    // Gerald (interaction agent) disconnected -- role eliminated
    // Responses are recorded but no longer routed to an agent for processing
    // See agents/interaction-gerald/ for original implementation if re-enabling
    return res.json({ success: true, message: 'Response recorded' });
  } catch (error) {
    console.error('[INTERACTION RESPONSE] Error responding to interaction:', error);
    res.status(500).json({ error: 'Failed to process interaction response' });
  }
}

export async function clearUserInteractions(req: Request, res: Response): Promise<Response | void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseService = getSupabaseService();
    const clearedCount = await supabaseService.cancelPendingInteractions(userId);

    res.json({
      success: true,
      message: `Cleared ${clearedCount} pending interactions for user`,
      cleared_count: clearedCount
    });
  } catch (error) {
    console.error('Error clearing user interactions:', error);
    return res.status(500).json({ error: 'Failed to clear interactions' });
  }
}

/**
 * Generate proactive interactions on app startup/login
 * Analyzes user's calendar, tasks, goals to create context-aware suggestions
 */
export async function generateStartupInteractions(req: Request, res: Response): Promise<Response | void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseService = getSupabaseService();
    const userProfile = await supabaseService.getProfile(userId);
    const timezone = userProfile?.timezone || 'UTC';

    // Gerald (interaction agent) disconnected -- role eliminated
    // Startup interaction generation is now a no-op
    console.log(`[STARTUP] Gerald disconnected, skipping proactive interaction generation for user ${userId}`);
    return res.json({
      success: true,
      message: 'Interaction generation disabled',
      initiated: false
    });
  } catch (error) {
    console.error('[STARTUP] Error generating startup interactions:', error);
    return res.status(500).json({ error: 'Failed to generate startup interactions' });
  }
}

