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

    console.log(`📥 [INTERACTION RESPONSE] User ${userId} responded to interaction ${interactionId} with: "${response}"`);

    if (!interactionId || typeof response !== 'string' || response.trim().length === 0) {
      return res.status(400).json({ error: 'interaction_id and response are required' });
    }

    const supabaseService = getSupabaseService();
    const saved = await supabaseService.saveInteractionResponse(userId, interactionId, response.trim());

    if (!saved) {
      console.log(`⚠️ [INTERACTION RESPONSE] Failed to save interaction response`);
      return res.status(404).json({ error: 'Interaction not found' });
    }

    console.log(`✅ [INTERACTION RESPONSE] Response saved to database`);

    // Get the interaction to understand the context
    const interaction = await supabaseService.getUserInteractionById(interactionId);
    if (!interaction) {
      console.log(`⚠️ [INTERACTION RESPONSE] Interaction not found by ID`);
      return res.status(404).json({ error: 'Interaction not found' });
    }

    console.log(`📋 [INTERACTION RESPONSE] Got interaction context: "${interaction.question}"`);

    // Call the agent to process the user's response
    const agentRegistry = AgentRegistry.getInstance();
    const conversationAgent = agentRegistry.getAgent('conversation');

    if (conversationAgent) {
      try {
        // Get user context
        const sessionId = `session-${userId}-${Date.now()}`;
        const userProfile = await supabaseService.getProfile(userId);
        const timezone = userProfile?.timezone || 'UTC';

        // Build a message that includes the interaction response and metadata
        let userMessage = `User responded to interaction "${interaction.question}": ${response}`;

        // If metadata exists, include it in the message for context
        if (interaction.metadata) {
          console.log(`📦 [INTERACTION RESPONSE] Interaction has metadata:`, JSON.stringify(interaction.metadata));
          userMessage += `\n[Metadata]: ${JSON.stringify(interaction.metadata)}`;
        } else {
          console.log(`⚠️ [INTERACTION RESPONSE] Interaction has no metadata - agent won't know what action to take`);
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

        console.log(`🤖 [INTERACTION RESPONSE] Invoking conversation agent with message: "${userMessage}"`);

        // Process the response asynchronously without blocking the response
        conversationAgent.processMessage(context, userMessage).catch(error => {
          console.error('❌ [INTERACTION RESPONSE] Error processing interaction response in agent:', error);
        });

        console.log(`✅ [INTERACTION RESPONSE] Agent invocation queued`);
      } catch (agentError) {
        // Log but don't fail the response - the interaction was already saved
        console.error('❌ [INTERACTION RESPONSE] Failed to invoke agent on interaction response:', agentError);
      }
    } else {
      console.warn(`⚠️ [INTERACTION RESPONSE] Conversation agent not found in registry`);
    }

    return res.json({
      success: true,
      message: 'Response saved successfully'
    });
  } catch (error) {
    console.error('❌ [INTERACTION RESPONSE] Error responding to interaction:', error);
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

