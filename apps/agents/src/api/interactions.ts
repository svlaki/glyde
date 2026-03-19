import { Request, Response } from 'express';

import { getSupabaseService } from '../services/SupabaseService.js';
import { AgentRegistry } from '../agents/AgentRegistry.js';
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

    // Route the response back to Gerald so it can use tools to act on it
    const agentRegistry = AgentRegistry.getInstance();
    const interactionAgent = agentRegistry.getAgent('interaction');

    if (!interactionAgent) {
      console.warn('[INTERACTION RESPONSE] Interaction agent not available');
      return res.json({ success: true, message: 'Response recorded' });
    }

    const userProfile = await supabaseService.getProfile(userId);
    const timezone = userProfile?.timezone || 'UTC';

    const sessionId = `interaction-response-${userId}-${Date.now()}`;
    const context = {
      userId,
      sessionId,
      timezone,
      conversationHistory: [],
      isInternal: true,
    };

    // Build a message that tells Gerald what happened and what to do
    const interactionType = interaction.interaction_type || 'unknown';
    const metadata = (interaction.metadata || {}) as any;
    const metadataContext = metadata.context ? ` Context: ${metadata.context}.` : '';
    const eventIdContext = metadata.eventId ? ` Event ID to update: ${metadata.eventId}.` : '';
    const eventTitleContext = metadata.eventTitle ? ` Event title: ${metadata.eventTitle}.` : '';

    // Calculate response time
    let responseTimeContext = '';
    if (interaction.created_at) {
      const createdAt = new Date(interaction.created_at);
      const respondedAt = new Date();
      const diffMs = respondedAt.getTime() - createdAt.getTime();
      const diffMinutes = Math.round(diffMs / 60000);
      if (diffMinutes < 60) {
        responseTimeContext = `\nResponse time: ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} after the interaction was created.`;
      } else {
        const diffHours = Math.round(diffMinutes / 60 * 10) / 10;
        responseTimeContext = `\nResponse time: ${diffHours} hour${diffHours === 1 ? '' : 's'} after the interaction was created.`;
      }
    }

    // Short-circuit: "Skip", "Chat", "No", "No thanks" need no agent processing
    const skipResponses = ['skip', 'no', 'no thanks', 'chat', 'dismiss'];
    if (skipResponses.includes(trimmedResponse.toLowerCase())) {
      console.log(`[INTERACTION RESPONSE] User said "${trimmedResponse}" — no action needed`);
      return res.json({ success: true, message: 'Response recorded, no action taken' });
    }

    const agentMessage = `INTERACTION RESPONSE - The user was asked: "${interaction.question}" (type: ${interactionType}, options: ${JSON.stringify(interaction.options || [])}).${metadataContext}${eventIdContext}${eventTitleContext}

The user responded: "${trimmedResponse}"${responseTimeContext}

Based on this response, take the appropriate action using your tools:
- If they picked a TIME (e.g. "3:30 PM", "5:00 PM"), create an event at that time using metadata.eventTitle and metadata.duration
- If they said "yes" or "accept", create the event using metadata.suggestedTime and metadata.duration
- If they gave a rating (1-10), the rating is already stored automatically. No action needed.
- If they gave a text response about an existing event (metadata.eventId), UPDATE that event's description
- If they gave a text response about a goal (metadata.goalId), UPDATE that goal's description
- If they gave a text response about an aspect, UPDATE that aspect's description
- Text responses MUST be saved to a visible entity (event/goal/aspect/task). The user NEVER sees your text replies.

Act on what the user wants. Do NOT create new interaction questions - just execute the action.`;

    console.log(`[INTERACTION RESPONSE] Routing to Gerald for processing`);

    // Run Gerald synchronously so we can return confirmation to the user
    let geraldResult: string | undefined;
    try {
      const result = await interactionAgent.processMessage(context, agentMessage);
      geraldResult = result?.content?.substring?.(0, 500);
      console.log(`[INTERACTION RESPONSE] Gerald processed response:`, geraldResult);
    } catch (geraldError: any) {
      console.error('[INTERACTION RESPONSE] Gerald error:', geraldError?.message);
    }

    return res.json({
      success: true,
      message: 'Response recorded and processed',
      agentResponse: geraldResult,
    });
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

    // Invoke the interaction agent to generate proactive interactions
    const agentRegistry = AgentRegistry.getInstance();
    const interactionAgent = agentRegistry.getAgent('interaction');

    if (!interactionAgent) {
      console.warn('[STARTUP] Interaction agent not available');
      return res.status(500).json({ error: 'Agent not available' });
    }

    const sessionId = `startup-${userId}-${Date.now()}`;
    const context = {
      userId,
      sessionId,
      timezone,
      conversationHistory: [],
      isInternal: true // Internal message - don't store in conversation history
    };

    // Send message requesting proactive analysis
    const analyzeMessage = `Analyze the user's calendar and tasks. Generate 0-2 proactive interaction suggestions using the create_interaction tool. Focus on scheduling time for high-priority tasks or preparing for upcoming events.`;

    console.log(`[STARTUP] Generating proactive interactions for user ${userId}`);
    console.log(`[STARTUP] Message to agent: "${analyzeMessage}"`);

    // Run asynchronously without blocking the response
    interactionAgent.processMessage(context, analyzeMessage)
      .then((result) => {
        console.log(`[STARTUP] Agent response received:`, result);
      })
      .catch(error => {
        console.error('[STARTUP] Error generating startup interactions:', error);
        console.error('[STARTUP] Full error details:', {
          message: error?.message,
          stack: error?.stack,
          toString: error?.toString()
        });
      });

    return res.json({
      success: true,
      message: 'Startup interaction generation initiated',
      initiated: true
    });
  } catch (error) {
    console.error('[STARTUP] Error generating startup interactions:', error);
    return res.status(500).json({ error: 'Failed to generate startup interactions' });
  }
}

