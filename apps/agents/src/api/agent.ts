import { Request, Response } from 'express';
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { ConversationAgent } from '../agents/conversation/ConversationAgent.js';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';

// Initialize the agent registry
const agentRegistry = AgentRegistry.getInstance();

// Initialize agents (should be done at startup)
async function initializeAgents() {
  try {
    const conversationAgent = new ConversationAgent();
    await agentRegistry.registerAgent(conversationAgent);
    console.log('✅ Agents initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize agents:', error);
  }
}

// Delay initialization to ensure env vars are loaded
setTimeout(() => {
  initializeAgents();
}, 100);

export async function processAgentMessage(req: Request, res: Response): Promise<void> {
  try {
    const { context, message, targetAgent, isInternal } = req.body;
    
    if (!context || !message) {
      res.status(400).json({ error: 'Missing context or message in request body' });
      return;
    }

    console.log(`🤖 Processing ${isInternal ? 'internal ' : ''}message for user ${context.userId}, target agent: ${targetAgent || 'auto-route'}`);
    
    // Convert context to AgentContext format
    const agentContext = {
      userId: context.userId,
      sessionId: context.sessionId || 'default',
      userSchema: context.userSchema || `u_${context.userId.replace(/-/g, '')}`,
      timezone: context.timezone,
      conversationHistory: context.conversationHistory || [],
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