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

    const pending = await supabaseService.getPendingUserInteractions(userId);

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
    const saved = await supabaseService.saveInteractionResponse(userId, interactionId, response.trim());

    if (!saved) {
      console.log(`[INTERACTION RESPONSE] Failed to save interaction response`);
      return res.status(404).json({ error: 'Interaction not found' });
    }

    console.log(`[INTERACTION RESPONSE] Response saved to database`);

    // Get the interaction to understand the context
    const interaction = await supabaseService.getUserInteractionById(interactionId);
    if (!interaction) {
      console.log(`[INTERACTION RESPONSE] Interaction not found by ID`);
      return res.status(404).json({ error: 'Interaction not found' });
    }

    console.log(`[INTERACTION RESPONSE] Got interaction context: "${interaction.question}"`);

    // Call the agent to process the user's response
    const agentRegistry = AgentRegistry.getInstance();
    const conversationAgent = agentRegistry.getAgent('conversation');

    if (conversationAgent) {
      try {
        // Get user context
        const sessionId = `session-${userId}-${Date.now()}`;
        const userProfile = await supabaseService.getProfile(userId);
        const timezone = userProfile?.timezone || 'UTC';

        // Determine if user said "yes" or "no" (case-insensitive)
        const userSaidYes = response.trim().toLowerCase() === 'yes' || response.trim().toLowerCase() === 'y';

        // Build a meaningful message based on the interaction action and user's response
        let userMessage = '';

        if (interaction.metadata && typeof interaction.metadata === 'object') {
          const metadata = interaction.metadata;
          const action = metadata.action;

          if (userSaidYes && action === 'check_goal_progress') {
            // For goal progress check-ins, use the follow-up prompt from metadata
            userMessage = metadata.followUpPrompt || `Let's check progress on "${metadata.goalTitle || 'your goal'}"`;
          } else if (userSaidYes && action === 'create_event') {
            // For event creation, pass the full event details
            userMessage = `Create an event: ${metadata.eventTitle}. ${JSON.stringify(metadata)}`;
          } else if (userSaidYes) {
            // Generic yes - just acknowledge and ask for action
            userMessage = `User wants to proceed with: ${metadata.reasoning || 'your suggestion'}. ${metadata.followUpPrompt || 'What would you like to do?'}`;
          } else {
            // User said no
            userMessage = `User declined the suggestion: "${interaction.question}". That's fine, let's move on.`;
          }

          console.log(`[INTERACTION RESPONSE] Interaction metadata:`, JSON.stringify(metadata));
        } else {
          // Fallback if no metadata
          userMessage = userSaidYes
            ? `User wants to proceed with the suggestion: "${interaction.question}". What should we do?`
            : `User declined the suggestion: "${interaction.question}". That's fine.`;
        }

        const context = {
          userId,
          sessionId,
          userSchema: 'public',
          timezone,
          conversationHistory: []
          // Note: NOT marked as internal so agent can store in memory/Zep for future context
          // This won't create a duplicate message in chat since it's not stored in conversation
        };

        console.log(`[INTERACTION RESPONSE] Invoking conversation agent with message: "${userMessage}"`);

        // Wait for agent response and return it to the user
        try {
          console.log(`[INTERACTION RESPONSE] About to invoke agent with message length: ${userMessage.length}`);
          const agentResponse = await conversationAgent.processMessage(context, userMessage);
          console.log(`[INTERACTION RESPONSE] Agent response type:`, typeof agentResponse);
          console.log(`[INTERACTION RESPONSE] Agent response:`, JSON.stringify(agentResponse));

          const responseContent = agentResponse?.content || agentResponse;
          console.log(`[INTERACTION RESPONSE] Final response content:`, responseContent);

          const responseStr = typeof responseContent === 'string' ? responseContent : String(responseContent || '');
          if (!responseStr || responseStr.trim().length === 0) {
            console.warn(`[INTERACTION RESPONSE] Agent returned empty response!`);
            return res.json({
              success: true,
              message: 'Response saved successfully',
              agentResponse: 'I processed your response, but couldn\'t generate a reply. Please continue the conversation in chat.'
            });
          }

          return res.json({
            success: true,
            message: 'Response saved successfully',
            agentResponse: responseStr
          });
        } catch (error) {
          console.error('[INTERACTION RESPONSE] Error processing interaction response in agent:', error);
          console.error('[INTERACTION RESPONSE] Error details:', error instanceof Error ? error.message : String(error));
          // Still return success since we saved the response, but include error info
          return res.json({
            success: true,
            message: 'Response saved successfully',
            error: 'Failed to generate agent response',
            agentResponse: 'I processed your response but encountered an error generating a reply. Please continue in chat.'
          });
        }
      } catch (agentError) {
        // Log but don't fail the response - the interaction was already saved
        console.error('[INTERACTION RESPONSE] Failed to invoke agent on interaction response:', agentError);
        return res.json({
          success: true,
          message: 'Response saved successfully'
        });
      }
    } else {
      console.warn(`[INTERACTION RESPONSE] Conversation agent not found in registry`);
      return res.json({
        success: true,
        message: 'Response saved successfully',
        warning: 'Agent not available'
      });
    }

    return res.json({
      success: true,
      message: 'Response saved successfully'
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

    // Invoke the conversation agent to generate proactive interactions
    const agentRegistry = AgentRegistry.getInstance();
    const conversationAgent = agentRegistry.getAgent('conversation');

    if (!conversationAgent) {
      console.warn('[STARTUP] Conversation agent not available');
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
    const analyzeMessage = `Generate 2-3 proactive suggestions based on my calendar, tasks, and goals. Use the analyze_context_for_interactions tool to generate context-aware recommendations. Then present them as interactive options.`;

    console.log(`[STARTUP] Generating proactive interactions for user ${userId}`);
    console.log(`[STARTUP] Message to agent: "${analyzeMessage}"`);

    // Run asynchronously without blocking the response
    conversationAgent.processMessage(context, analyzeMessage)
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

