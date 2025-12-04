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
    console.log(`[INTERACTION RESPONSE] Interaction options: ${JSON.stringify(interaction.options)}`);
    console.log(`[INTERACTION RESPONSE] Interaction metadata: ${JSON.stringify(interaction.metadata, null, 2)}`);

    // Check if this is a positive response that should trigger follow-up or action
    const isPositiveResponse = ['yes', 'accept', 'ok', 'sure', 'sounds good', 'do it', 'go ahead'].some(
      positive => trimmedResponse.toLowerCase().includes(positive)
    );
    console.log(`[INTERACTION RESPONSE] Is positive response: ${isPositiveResponse}`);

    // Check for follow-up interaction (when user says yes, show next step)
    if (interaction.metadata && typeof interaction.metadata === 'object') {
      const metadata = interaction.metadata as any;
      console.log(`[INTERACTION RESPONSE] Has followUp: ${!!metadata.followUp}, Has directAction: ${!!metadata.directAction}`);

      // FOLLOW-UP PATH: Create follow-up interaction if user responded positively
      if (isPositiveResponse && metadata.followUp) {
        console.log(`[INTERACTION RESPONSE] Creating follow-up interaction`);
        try {
          const followUp = metadata.followUp;
          const followUpInteraction = await supabaseService.createUserInteraction(userId, {
            agentId: 'interaction',
            question: followUp.question,
            interactionType: followUp.type || 'multiple_choice',
            options: followUp.options || null,
            priority: followUp.priority || 4,
            metadata: followUp.metadata || null,
          });

          // Mark original interaction as completed
          await supabaseService.updateInteractionStatus(interactionId, 'cancelled');

          console.log(`[INTERACTION RESPONSE] Follow-up interaction created: ${followUpInteraction?.id}`);
          return res.json({
            success: true,
            message: 'Follow-up interaction created',
            followUpId: followUpInteraction?.id,
            hasFollowUp: true
          });
        } catch (error) {
          console.error(`[INTERACTION RESPONSE] Error creating follow-up:`, error);
          // Fall through to try direct action
        }
      }

      // DIRECT ACTION PATH: Execute action if response is positive or matches an option
      if (metadata.directAction) {
        // Only execute on positive response, or if the response matches a specific option
        const shouldExecute = isPositiveResponse ||
          (interaction.options && interaction.options.includes(trimmedResponse));

        if (shouldExecute) {
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

              // Parse start time from response if it's a time option (e.g., "9:00am", "2pm", "6:30pm")
              let startTime = eventData.startTime;
              if (!startTime) {
                console.log(`[INTERACTION RESPONSE] No startTime in eventData, attempting to parse from response: "${trimmedResponse}"`);

                // Try to parse time from response like "9:00am", "2pm", "6:30pm", "Morning (7am)"
                const timeMatch = trimmedResponse.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]m)/i);
                if (timeMatch) {
                  let hours = parseInt(timeMatch[1]);
                  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                  const isPM = timeMatch[3].toLowerCase() === 'pm';

                  // Convert to 24-hour format
                  if (isPM && hours !== 12) {
                    hours += 12;
                  } else if (!isPM && hours === 12) {
                    hours = 0; // 12am = 0:00
                  }

                  const now = new Date();
                  now.setHours(hours, minutes, 0, 0);

                  // If the time has already passed today, schedule for tomorrow
                  if (now <= new Date()) {
                    now.setDate(now.getDate() + 1);
                  }

                  startTime = now.toISOString();
                  console.log(`[INTERACTION RESPONSE] Parsed time: ${hours}:${minutes.toString().padStart(2, '0')} -> ${startTime}`);
                } else {
                  console.log(`[INTERACTION RESPONSE] Could not parse time from response, using current time`);
                }
              }

              startTime = startTime || new Date().toISOString();
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

            } else if (actionType === 'create_goal') {
              console.log(`[INTERACTION RESPONSE] Creating goal from metadata`);
              if (!metadata.directAction.goalData) {
                throw new Error('goalData required for create_goal action');
              }
              const goalData = metadata.directAction.goalData;
              actionResult = await supabaseService.createGoal(userId, {
                title: goalData.title || 'Goal',
                description: goalData.description || '',
                targetDate: goalData.targetDate || null,
                category_id: goalData.categoryId || null,
                goalType: goalData.goalType || 'SMART',
              });
              console.log(`[INTERACTION RESPONSE] Goal created: ${actionResult?.id}`);

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
    }

    // Mark interaction as completed even if no action was taken
    await supabaseService.updateInteractionStatus(interactionId, 'cancelled');

    console.log(`[INTERACTION RESPONSE] Response processed successfully`);
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

