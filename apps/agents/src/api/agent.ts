import { Request, Response } from 'express';
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { ConversationAgent } from '../agents/conversation/ConversationAgent.js';
import { InteractionAgent } from '../agents/interaction/InteractionAgent.js';
import { InteractionAgentGerald } from '../agents/interaction-gerald/InteractionAgentGerald.js';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { ACTIVE_INTERACTION_AGENT } from '../config/agents.js';

// Initialize the agent registry
const agentRegistry = AgentRegistry.getInstance();

let initializationPromise: Promise<void> | null = null;

/**
 * Factory function to create the active interaction agent based on config
 */
function createInteractionAgent() {
  switch (ACTIVE_INTERACTION_AGENT) {
    case 'gerald':
      console.log('🤖 Using InteractionAgentGerald (enhanced)');
      return new InteractionAgentGerald();
    case 'default':
    default:
      console.log('🤖 Using InteractionAgent (default)');
      return new InteractionAgent();
  }
}

async function initializeAgents(): Promise<void> {
  const conversationAgent = new ConversationAgent();
  await agentRegistry.registerAgent(conversationAgent);

  const interactionAgent = createInteractionAgent();
  await agentRegistry.registerAgent(interactionAgent);
}

async function ensureAgentsInitialized(): Promise<void> {
  if (agentRegistry.hasAgent('conversation') && agentRegistry.hasAgent('interaction')) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = initializeAgents()
      .then(() => {
        console.log('✅ Agents initialized successfully');
      })
      .catch(error => {
        console.error('❌ Failed to initialize agents:', error);
        throw error;
      })
      .finally(() => {
        initializationPromise = null;
      });
  }

  await initializationPromise;
}

// Kick off initialization eagerly but don't block module evaluation
ensureAgentsInitialized().catch(error => {
  console.error('❌ Agent initialization failed during startup:', error);
});

export async function processAgentMessage(req: Request, res: Response): Promise<void> {
  try {
    await ensureAgentsInitialized();

    console.log('📥 [AGENT] Received request body:', JSON.stringify(req.body, null, 2));
    const { context, message, targetAgent, isInternal } = req.body;

    if (!context || typeof context !== 'object' || !message) {
      console.error('❌ [AGENT] Missing context or message:', { context: !!context, message: !!message });
      res.status(400).json({ error: 'Missing context or message in request body' });
      return;
    }

    if (typeof message !== 'string') {
      res.status(400).json({ error: 'message must be a string' });
      return;
    }

    if (!context.userId || typeof context.userId !== 'string') {
      res.status(400).json({ error: 'context.userId is required' });
      return;
    }

    console.log(`🤖 Processing ${isInternal ? 'internal ' : ''}message for user ${context.userId}, target agent: ${targetAgent || 'auto-route'}`);

    // Convert context to AgentContext format
    const agentContext = {
      userId: context.userId,
      sessionId: context.sessionId || 'default',
      userSchema: context.userSchema || `u_${context.userId.replace(/-/g, '')}`,
      timezone: typeof context.timezone === 'string' && context.timezone.length > 0 ? context.timezone : 'UTC',
      conversationHistory: Array.isArray(context.conversationHistory) ? context.conversationHistory : [],
      userProfile: context.userProfile,
      isInternal: isInternal || false // Pass internal flag to agent
    };

    // Route message through agent registry
    const response = await agentRegistry.routeMessage(agentContext, message, targetAgent);
    
    console.log(`✅ Agent response: ${response.content.substring(0, 100)}...`);
    
    res.json({
      success: true,
      response: response.content, // Return just the content string, not the whole object
      processingTime: Date.now() - (req as any).startTime,
      // Keep additional data separate if needed
      metadata: {
        type: response.type,
        data: response.data,
        needsUserInput: response.needsUserInput,
        suggestedActions: response.suggestedActions,
        agentType: targetAgent,
        isInternal: isInternal
      }
    });
    
  } catch (error) {
    console.error('Error processing agent message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


// Middleware to add start time for processing time calculation
export function addStartTime(req: Request, res: Response, next: any): void {
  (req as any).startTime = Date.now();
  next();
}