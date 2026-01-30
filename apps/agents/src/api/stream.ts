import { Request, Response } from 'express';
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { ConversationAgent } from '../agents/conversation/ConversationAgent.js';
import { ImageContent } from '../types/agents.js';

// Get the shared agent registry instance
const agentRegistry = AgentRegistry.getInstance();

let initializationPromise: Promise<void> | null = null;

async function initializeAgents(): Promise<void> {
  if (!agentRegistry.hasAgent('conversation')) {
    const conversationAgent = new ConversationAgent();
    await agentRegistry.registerAgent(conversationAgent);
  }
}

async function ensureAgentsInitialized(): Promise<void> {
  if (agentRegistry.hasAgent('conversation')) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = initializeAgents()
      .then(() => {
        console.log('✅ [STREAM] Agents initialized successfully');
      })
      .catch(error => {
        console.error('❌ [STREAM] Failed to initialize agents:', error);
        throw error;
      })
      .finally(() => {
        initializationPromise = null;
      });
  }

  await initializationPromise;
}

// Kick off initialization eagerly
ensureAgentsInitialized().catch(error => {
  console.error('❌ [STREAM] Agent initialization failed during startup:', error);
});

/**
 * Streaming endpoint for chat messages using Server-Sent Events (SSE).
 * Follows the Vercel AI SDK Data Stream Protocol.
 */
export async function streamAgentMessage(req: Request, res: Response): Promise<void> {
  try {
    await ensureAgentsInitialized();

    // AI SDK v5 sends { messages: [...], ...customBody }
    // We also support legacy format { context, message }
    console.log('🌊 [STREAM] Raw request body:', JSON.stringify(req.body, null, 2));
    const { messages: aiMessages, context: legacyContext, message: legacyMessage, targetAgent } = req.body;

    let context: any;
    let message: string;

    // Extract images from message content (for vision support)
    let images: ImageContent[] = [];

    // Handle AI SDK v5 format (messages array with custom body fields)
    if (Array.isArray(aiMessages) && aiMessages.length > 0) {
      // Extract the last user message
      const lastUserMessage = [...aiMessages].reverse().find((m: any) => m.role === 'user');
      if (!lastUserMessage) {
        res.status(400).json({ error: 'No user message found in messages array' });
        return;
      }

      // Message content can be string or parts array in AI SDK v5
      if (typeof lastUserMessage.content === 'string') {
        message = lastUserMessage.content;
      } else if (Array.isArray(lastUserMessage.parts)) {
        // Extract text from parts
        const textPart = lastUserMessage.parts.find((p: any) => p.type === 'text');
        message = textPart?.text || '';
        // Extract images from parts
        images = lastUserMessage.parts
          .filter((p: any) => p.type === 'image_url')
          .map((p: any) => ({ type: 'image_url' as const, image_url: p.image_url }));
      } else if (Array.isArray(lastUserMessage.content)) {
        // Handle content as array of parts
        const textPart = lastUserMessage.content.find((p: any) => p.type === 'text');
        message = textPart?.text || '';
        // Extract images from content array
        images = lastUserMessage.content
          .filter((p: any) => p.type === 'image_url')
          .map((p: any) => ({ type: 'image_url' as const, image_url: p.image_url }));
      } else {
        message = '';
      }

      // Context comes from custom body fields (merged by AI SDK transport)
      context = req.body.context || {};

      // If no userId in context, try to get from auth
      if (!context.userId && req.authUserId) {
        context.userId = req.authUserId;
      }

      // Build conversation history from messages array (excluding the last message)
      if (!context.conversationHistory) {
        context.conversationHistory = aiMessages.slice(0, -1).map((m: any) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content :
            (m.parts?.find((p: any) => p.type === 'text')?.text || '')
        }));
      }

      console.log(`🌊 [STREAM] AI SDK v5 format - extracted message: "${message.substring(0, 50)}..."${images.length > 0 ? ` with ${images.length} image(s)` : ''}`);
    }
    // Handle legacy format
    else if (legacyContext && legacyMessage) {
      context = legacyContext;
      message = legacyMessage;
      console.log(`🌊 [STREAM] Legacy format - message: "${message.substring(0, 50)}..."`);
    }
    // Invalid request
    else {
      res.status(400).json({ error: 'Missing messages array or context/message in request body' });
      return;
    }

    // Validate extracted data
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Could not extract valid message from request' });
      return;
    }

    if (!context.userId || typeof context.userId !== 'string') {
      res.status(400).json({ error: 'context.userId is required' });
      return;
    }

    console.log(`🌊 [STREAM] Starting stream for user ${context.userId}`);

    // Set headers for text stream protocol (simpler than data stream)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Build agent context
    const agentContext = {
      userId: context.userId,
      sessionId: context.sessionId || 'default',
      timezone: typeof context.timezone === 'string' && context.timezone.length > 0
        ? context.timezone : 'UTC',
      conversationHistory: Array.isArray(context.conversationHistory)
        ? context.conversationHistory : [],
      userProfile: context.userProfile,
      isInternal: false,
      currentPage: context.currentPage || 'dashboard'
    };

    // Get conversation agent
    const agent = agentRegistry.getAgent('conversation') as ConversationAgent;
    if (!agent) {
      res.write(`3:"Agent not available"\n`);
      res.end();
      return;
    }

    // Check if agent supports streaming
    if (typeof agent.streamMessage !== 'function') {
      console.error('❌ [STREAM] Agent does not support streaming, falling back to non-streaming');
      // Fallback: use regular processMessage and send entire response
      const response = await agent.processMessage(agentContext, message);
      res.write(`0:${JSON.stringify(response.content)}\n`);
      res.write(`d:${JSON.stringify({ finishReason: 'stop' })}\n`);
      res.end();
      return;
    }

    const startTime = Date.now();
    let fullResponse = '';
    const toolsUsed: string[] = [];

    try {
      // Stream the response using the agent's streamMessage method
      // Using TEXT STREAM PROTOCOL - just send plain text chunks
      let chunkCount = 0;
      console.log(`🌊 [STREAM] Starting to stream events (text protocol)...`);
      for await (const event of agent.streamMessage(agentContext, message, images)) {
        if (event.type === 'status' && event.content) {
          // Send status updates as SSE-style events that frontend can parse
          // Format: [STATUS:message] - frontend will strip this and show in UI
          console.log(`📊 [STREAM] Status: ${event.content}`);
          res.write(`[STATUS:${event.content}]`);
        } else if (event.type === 'text-delta' && event.content) {
          fullResponse += event.content;
          chunkCount++;
          // Text stream protocol: just send the raw text
          console.log(`🌊 [STREAM] Sending text chunk ${chunkCount}: "${event.content}"`);
          res.write(event.content);
        } else if (event.type === 'tool-start' && event.toolName) {
          toolsUsed.push(event.toolName);
          // Send tool status so frontend can show what's happening
          console.log(`🔧 [STREAM] Tool started: ${event.toolName}`);
          res.write(`[STATUS:${formatToolName(event.toolName)}]`);
        } else if (event.type === 'tool-end' && event.toolName) {
          console.log(`🔧 [STREAM] Tool ended: ${event.toolName}`);
        } else if (event.type === 'error') {
          console.error(`❌ [STREAM] Error event: ${event.content}`);
          res.write(`\n\nError: ${event.content || 'Unknown error'}`);
        }
      }

      console.log(`✅ [STREAM] Completed stream for user ${context.userId} in ${Date.now() - startTime}ms`);
      console.log(`✅ [STREAM] Total chunks sent: ${chunkCount}, Full response length: ${fullResponse.length}`);

    } catch (streamError) {
      console.error('❌ [STREAM] Error during streaming:', streamError);
      res.write(`\n\nError: ${streamError instanceof Error ? streamError.message : 'Stream error'}`);
    }

    res.end();

  } catch (error) {
    console.error('❌ [STREAM] Error in stream endpoint:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to process stream',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } else {
      res.end();
    }
  }
}

/**
 * Convert tool names to user-friendly display names
 */
function formatToolName(toolName: string): string {
  const toolDisplayNames: Record<string, string> = {
    'create_event': 'Creating event...',
    'update_event': 'Updating event...',
    'delete_event': 'Deleting event...',
    'search_events': 'Searching calendar...',
    'get_events': 'Loading calendar...',
    'create_task': 'Creating task...',
    'update_task': 'Updating task...',
    'delete_task': 'Deleting task...',
    'get_tasks': 'Loading tasks...',
    'create_goal': 'Creating goal...',
    'update_goal': 'Updating goal...',
    'delete_goal': 'Deleting goal...',
    'get_goals': 'Loading goals...',
  };

  return toolDisplayNames[toolName] || `Running ${toolName.replace(/_/g, ' ')}...`;
}
