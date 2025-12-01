import { Request, Response } from 'express';

import { getSupabaseService } from '../services/SupabaseService.js';
import { AgentRegistry } from '../agents/AgentRegistry.js';

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

    // Get the interaction first to check for direct actions
    const interaction = await supabaseService.getUserInteractionById(interactionId);
    if (!interaction) {
      console.log(`[INTERACTION RESPONSE] Interaction not found by ID`);
      return res.status(404).json({ error: 'Interaction not found' });
    }

    // DISMISS PATH: If user dismissed interaction, just cancel it
    if (trimmedResponse === 'dismissed') {
      console.log(`[INTERACTION RESPONSE] User dismissed interaction ${interactionId}`);
      const dismissed = await supabaseService.updateInteractionStatus(interactionId, 'cancelled');

      if (!dismissed) {
        return res.status(500).json({ error: 'Failed to dismiss interaction' });
      }

      return res.json({
        success: true,
        message: 'Interaction dismissed'
      });
    }

    // Save the response
    const saved = await supabaseService.saveInteractionResponse(userId, interactionId, trimmedResponse);
    if (!saved) {
      console.log(`[INTERACTION RESPONSE] Failed to save interaction response`);
      return res.status(404).json({ error: 'Interaction not found' });
    }

    console.log(`[INTERACTION RESPONSE] Response saved to database`);
    console.log(`[INTERACTION RESPONSE] Got interaction context: "${interaction.question}"`);

    // DIRECT ACTION PATH: Check if metadata has directAction instructions
    if (interaction.metadata && typeof interaction.metadata === 'object') {
      const metadata = interaction.metadata as any;
      if (metadata.directAction) {
        console.log(`[INTERACTION RESPONSE] Executing direct action`);
        console.log(`[INTERACTION RESPONSE] Action type: ${metadata.directAction.type}`);

        try {
          const actionType = metadata.directAction.type;
          let actionResult = null;

          // Execute the appropriate action based on type
          if (actionType === 'create_event') {
            console.log(`[INTERACTION RESPONSE] Creating event from metadata`);
            if (!metadata.directAction.eventData) {
              throw new Error('eventData required for create_event action');
            }
            const eventData = metadata.directAction.eventData;

            // Calculate start and end times
            const startTime = eventData.startTime ? new Date(eventData.startTime).toISOString() : new Date().toISOString();
            const duration = eventData.duration || 60; // minutes
            const endDate = new Date(new Date(startTime).getTime() + duration * 60000);
            const endTime = endDate.toISOString();

            actionResult = await supabaseService.createEvent(userId, {
              title: eventData.title || 'Event',
              description: eventData.description || '',
              start_time: startTime,
              end_time: endTime,
              category_id: eventData.categoryId || null,
              location: eventData.location || null,
            });
            console.log(`[INTERACTION RESPONSE] Event created: ${actionResult?.id}`);

          } else if (actionType === 'create_task') {
            console.log(`[INTERACTION RESPONSE] Creating task from metadata`);
            if (!metadata.directAction.taskData) {
              throw new Error('taskData required for create_task action');
            }
            const taskData = metadata.directAction.taskData;
            actionResult = await supabaseService.createTask(userId, {
              title: taskData.title || 'Task',
              description: taskData.description || '',
              dueDate: taskData.dueDate || null,
              category_id: taskData.categoryId || null,
            });
            console.log(`[INTERACTION RESPONSE] Task created: ${actionResult?.id}`);

          } else if (actionType === 'update_task') {
            console.log(`[INTERACTION RESPONSE] Updating task from metadata`);
            if (!metadata.directAction.taskId || !metadata.directAction.taskData) {
              throw new Error('taskId and taskData required for update_task action');
            }
            const taskId = metadata.directAction.taskId;
            const taskData = metadata.directAction.taskData;
            actionResult = await supabaseService.updateTask(userId, taskId, {
              title: taskData.title,
              description: taskData.description,
              dueDate: taskData.dueDate,
              category_id: taskData.categoryId,
              status: taskData.status as any,
            });
            console.log(`[INTERACTION RESPONSE] Task updated: ${taskId}`);

          } else {
            throw new Error(`Unknown action type: ${actionType}`);
          }

          // Mark interaction as completed/cancelled
          const completed = await supabaseService.updateInteractionStatus(interactionId, 'cancelled');

          if (!completed) {
            throw new Error('Failed to update interaction status');
          }

          return res.json({
            success: true,
            message: `Action executed: ${actionType}`,
            actionResult
          });
        } catch (error) {
          console.error(`[INTERACTION RESPONSE] Error executing direct action:`, error);
          console.error(`[INTERACTION RESPONSE] Error details:`, error instanceof Error ? error.message : String(error));
          // Don't fall through - return error since we already saved the response
          return res.json({
            success: false,
            message: 'Failed to execute interaction action',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    // For now, just return success - the response has been saved to the database
    // NOTE: This is a temporary simplification until directAction metadata is fully implemented
    // In the future, responses will be processed via:
    // 1. Direct actions (instant, from metadata.directAction)
    // 2. Agent processing (with proper tools for creating events/tasks)
    // 3. Zep memory integration (store response context for future conversations)

    console.log(`[INTERACTION RESPONSE] Response processed successfully (direct action path not yet implemented)`);
    return res.json({
      success: true,
      message: 'Your response has been recorded',
      agentResponse: 'Thanks for responding! Your feedback helps me understand your preferences better.'
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

    // Check if user already has active interactions (limit 2 per user in DB)
    const pending = await supabaseService.getPendingUserInteractions(userId);
    if (pending && pending.length >= 2) {
      console.log(`[STARTUP] User ${userId} already has ${pending.length} pending interactions (max 2), skipping generation`);
      return res.json({
        success: true,
        message: 'User already has maximum pending interactions',
        skipped: true,
        existing_count: pending.length
      });
    }

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
      userSchema: 'public',
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
    console.error('❌ [STARTUP] Error generating startup interactions:', error);
    return res.status(500).json({ error: 'Failed to generate startup interactions' });
  }
}

