import { Request, Response } from 'express';

import { getSupabaseService } from '../services/SupabaseService.js';
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { ensureProactiveAgent } from '../agents/proactive/ProactiveAgent.js';
import { AgentContext } from '../types/agents.js';

const agentRegistry = AgentRegistry.getInstance();

function buildAgentContext(userId: string, timezone: string, profile?: { id: string; email: string; timezone?: string | null } | null): AgentContext {
  const safeTimezone = timezone || 'UTC';

  return {
    userId,
    sessionId: `proactive-${Date.now()}`,
    userSchema: `u_${userId.replace(/-/g, '')}`,
    timezone: safeTimezone,
    conversationHistory: [],
    userProfile: profile
      ? {
          id: profile.id,
          email: profile.email,
          timezone: profile.timezone || undefined,
          preferences: {},
          goals: [],
          insights: []
        }
      : undefined,
    isInternal: true
  };
}

export async function getPendingInteractions(req: Request, res: Response): Promise<Response | void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseService = getSupabaseService();
    const profile = await supabaseService.getProfile(userId);

    await ensureProactiveAgent(agentRegistry);

    const context = buildAgentContext(userId, profile?.timezone || req.body?.timezone || 'UTC', profile);
    const agent = agentRegistry.requireAgent('proactive');

    const agentResult = await agent.processMessage(
      context,
      JSON.stringify({ command: 'generate_interactions', manual: Boolean(req.body?.manual) })
    );

    const pending = await supabaseService.getPendingUserInteractions(userId, 'proactive');

    return res.json({
      success: true,
      interactions: pending,
      summary: agentResult.content,
      metadata: agentResult.data
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

    if (!interactionId || typeof response !== 'string' || response.trim().length === 0) {
      return res.status(400).json({ error: 'interaction_id and response are required' });
    }

    const supabaseService = getSupabaseService();
    const saved = await supabaseService.saveInteractionResponse(userId, interactionId, response.trim());

    if (!saved) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    await ensureProactiveAgent(agentRegistry);

    const profile = await supabaseService.getProfile(userId);
    const context = buildAgentContext(userId, profile?.timezone || saved.interaction?.metadata?.timezone || 'UTC', profile);

    const agent = agentRegistry.requireAgent(saved.interaction?.agent_id || 'proactive');
    const agentResult = await agent.processMessage(
      context,
      JSON.stringify({
        command: 'handle_response',
        interactionId,
        response: response.trim(),
        interaction: saved.interaction
      })
    );

    return res.json({
      success: true,
      message: agentResult.content,
      metadata: agentResult.data
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

export async function triggerProactiveAgent(req: Request, res: Response): Promise<Response | void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseService = getSupabaseService();
    const profile = await supabaseService.getProfile(userId);

    await ensureProactiveAgent(agentRegistry);

    const before = await supabaseService.getPendingUserInteractions(userId, 'proactive');
    const context = buildAgentContext(userId, profile?.timezone || req.body?.timezone || 'UTC', profile);
    const agent = agentRegistry.requireAgent('proactive');

    const agentResult = await agent.processMessage(
      context,
      JSON.stringify({ command: 'generate_interactions', manual: true })
    );

    const after = await supabaseService.getPendingUserInteractions(userId, 'proactive');

    const createdCount = Math.max(after.length - before.length, 0);

    res.json({
      success: true,
      message: agentResult.content,
      interactionsCreated: createdCount,
      metadata: agentResult.data
    });
  } catch (error) {
    console.error('Error triggering proactive agent:', error);
    res.status(500).json({ error: 'Failed to run proactive agent' });
  }
}

