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
    const { context, message, targetAgent } = req.body;
    
    if (!context || !message) {
      res.status(400).json({ error: 'Missing context or message in request body' });
      return;
    }

    console.log(`🤖 Processing message for user ${context.userId}, target agent: ${targetAgent || 'auto-route'}`);
    
    // Convert context to AgentContext format
    const agentContext = {
      userId: context.userId,
      sessionId: context.sessionId || 'default',
      userSchema: context.userSchema || `u_${context.userId.replace(/-/g, '')}`,
      timezone: context.timezone,
      conversationHistory: context.conversationHistory || [],
      userProfile: context.userProfile
    };

    // Route message through agent registry
    const response = await agentRegistry.routeMessage(agentContext, message, targetAgent);
    
    console.log(`✅ Agent response: ${response.content.substring(0, 100)}...`);
    
    res.json({
      success: true,
      response: {
        content: response.content,
        type: response.type,
        data: response.data,
        needsUserInput: response.needsUserInput,
        suggestedActions: response.suggestedActions,
        agentType: targetAgent,
        processingTime: Date.now() - (req as any).startTime
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

export async function getSystemPrompt(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({ error: 'Missing userId in request body' });
      return;
    }

    // Get system prompt from conversation agent
    const conversationAgent = agentRegistry.getAgent('conversation');
    if (!conversationAgent) {
      res.status(500).json({ error: 'Conversation agent not available' });
      return;
    }

    const systemPrompt = conversationAgent.getSystemPrompt();
    
    res.json({
      success: true,
      prompt: systemPrompt
    });
    
  } catch (error) {
    console.error('Error getting system prompt:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get system prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function getAgentCapabilities(req: Request, res: Response): Promise<void> {
  try {
    const overview = agentRegistry.getSystemOverview();
    
    res.json({
      success: true,
      capabilities: overview.capabilities,
      totalAgents: overview.totalAgents,
      registeredTypes: overview.registeredTypes
    });
    
  } catch (error) {
    console.error('Error getting agent capabilities:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get agent capabilities',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function getSystemOverview(req: Request, res: Response): Promise<void> {
  try {
    const overview = agentRegistry.getSystemOverview();
    
    res.json({
      success: true,
      ...overview
    });
    
  } catch (error) {
    console.error('Error getting system overview:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get system overview',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function getUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({ error: 'Missing userId in request body' });
      return;
    }

    // TODO: Implement user profile retrieval from database
    // For now, return a basic profile
    const profile = {
      id: userId,
      email: '',
      preferences: {},
      goals: [],
      insights: []
    };
    
    res.json({
      success: true,
      profile
    });
    
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get user profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Middleware to add start time for processing time calculation
export function addStartTime(req: Request, res: Response, next: any): void {
  (req as any).startTime = Date.now();
  next();
}