import { Request, Response } from 'express';
import { SupabaseService, supabase } from '../services/SupabaseService.js';
import { EmbeddingService } from '../services/EmbeddingService.js';
import { ConversationAgent } from '../agents/conversation/ConversationAgent.js';
import { AgentContext } from '../types/agents.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { streamText } from 'ai';
import { ChatOpenAI } from '@langchain/openai';
import { DatabaseChatMessage } from '../types/database.js';

let supabaseService: SupabaseService | null = null;
let embeddingService: EmbeddingService | null = null;
let conversationAgent: ConversationAgent | null = null;

function getSupabaseService(): SupabaseService {
  if (!supabaseService) {
    supabaseService = new SupabaseService();
  }
  return supabaseService;
}

function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
  return embeddingService;
}

function getConversationAgent(): ConversationAgent {
  if (!conversationAgent) {
    conversationAgent = new ConversationAgent();
  }
  return conversationAgent;
}

export async function handleChatMessage(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, message, session_id } = req.body;
    
    if (!user_id || !message || !session_id) {
      res.status(400).json({ error: 'Missing required fields: user_id, message, session_id' });
      return;
    }

    console.log('Processing chat message:', { user_id, message, session_id });

    console.log('Step 1: Generating embedding...');
    // Generate embedding for the message
    const embedding = await getEmbeddingService().generateEmbedding(message);
    console.log('Step 1: Embedding generated');

    console.log('Step 2: Storing user message via RPC...');
    // Store user message using RPC function to avoid schema access issues
    const { data: userMessageId, error: userMessageError } = await supabase
      .rpc('add_user_chat_message', {
        p_user_id: user_id,
        p_session_id: session_id,
        p_content: message,
        p_sender: 'user',
        p_embedding: embedding
      });
      
    if (userMessageError) {
      console.error('Error storing user message via RPC:', userMessageError);
      // Continue anyway - we can still process the message
    } else {
      console.log('Step 2: User message stored successfully via RPC, ID:', userMessageId);
    }

    console.log('Step 3: Getting conversation history via RPC...');
    // Get conversation history using RPC function
    const { data: chatHistory, error: historyError } = await supabase
      .rpc('get_user_chat_messages', {
        p_user_id: user_id,
        p_session_id: session_id,
        p_limit: 50
      });
      
    const conversationHistory = chatHistory?.map((msg: any) => 
      msg.sender === 'user' 
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content)
    ) || [];
    
    console.log('Step 3: Conversation history retrieved:', conversationHistory.length, 'messages');
    
    console.log('Step 4: Creating agent context...');
    // Create agent context
    const agentContext: AgentContext = {
      userId: user_id,
      sessionId: session_id,
      userSchema: user_id, // Using user_id as schema for now
      conversationHistory
    };

    console.log('Step 5: Processing message through conversation agent...');
    // Process the message through the conversation agent
    const agentResponse = await getConversationAgent().processMessage(agentContext, message);
    console.log('Step 5: Agent response received:', agentResponse.content.substring(0, 100) + '...');

    console.log('Step 6: Storing agent response via RPC...');
    // Generate embedding for the agent response
    const responseEmbedding = await getEmbeddingService().generateEmbedding(agentResponse.content);

    // Store agent response using RPC function
    const { data: aiMessageId, error: aiMessageError } = await supabase
      .rpc('add_user_chat_message', {
        p_user_id: user_id,
        p_session_id: session_id,
        p_content: agentResponse.content,
        p_sender: 'assistant',
        p_embedding: responseEmbedding
      });
      
    if (aiMessageError) {
      console.error('Error storing AI message via RPC:', aiMessageError);
      // Continue anyway - we can still return the response
    } else {
      console.log('Step 6: Agent response stored successfully via RPC, ID:', aiMessageId);
    }

    res.json({
      success: true,
      response: agentResponse.content,
      id: aiMessageId || Date.now().toString()
    });

  } catch (error) {
    console.error('Error handling chat message:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
}

export async function getChatHistory(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, session_id, limit = 50 } = req.body;
    
    if (!user_id || !session_id) {
      console.log('❌ [CHAT HISTORY] Missing required fields');
      res.status(400).json({ error: 'Missing required fields: user_id, session_id' });
      return;
    }

    console.log('🔍 [CHAT HISTORY] Getting chat history for:', { user_id, session_id, limit });

    // Use RPC function to access user schema (bypasses PostgREST schema restrictions)
    const { data: chatHistory, error: historyError } = await supabase
      .rpc('get_user_chat_messages', {
        p_user_id: user_id,
        p_session_id: session_id,
        p_limit: limit
      });
      
    if (historyError) {
      console.error('❌ [CHAT HISTORY] Error fetching chat history via RPC:', historyError);
      console.error('❌ [CHAT HISTORY] Error details:', JSON.stringify(historyError, null, 2));
      res.status(500).json({ error: 'Failed to get chat history', details: historyError.message });
      return;
    }

    console.log('✅ [CHAT HISTORY] Retrieved', chatHistory?.length || 0, 'messages via RPC');
    
    res.json({
      success: true,
      messages: chatHistory || []
    });

  } catch (error) {
    console.error('❌ [CHAT HISTORY] Error getting chat history:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
}

export async function handleStreamingChat(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, message, session_id } = req.body;
    
    if (!user_id || !message || !session_id) {
      res.status(400).json({ error: 'Missing required fields: user_id, message, session_id' });
      return;
    }

    console.log('Processing streaming chat message:', { user_id, message, session_id });

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Generate embedding for the message
    const embedding = await getEmbeddingService().generateEmbedding(message);

    // Store user message using RPC function
    const { data: userMessageId, error: userMessageError } = await supabase
      .rpc('add_user_chat_message', {
        p_user_id: user_id,
        p_session_id: session_id,
        p_content: message,
        p_sender: 'user',
        p_embedding: embedding
      });

    if (userMessageError) {
      console.error('Error storing user message via RPC:', userMessageError);
      res.write('error: Failed to store user message\n');
      res.end();
      return;
    }

    // Get conversation history using RPC function
    const { data: chatHistory, error: historyError } = await supabase
      .rpc('get_user_chat_messages', {
        p_user_id: user_id,
        p_session_id: session_id,
        p_limit: 50
      });
      
    const conversationHistory = chatHistory?.map((msg: any) => 
      msg.sender === 'user' 
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content)
    ) || [];
    
    // Create agent context
    const agentContext: AgentContext = {
      userId: user_id,
      sessionId: session_id,
      userSchema: user_id,
      conversationHistory
    };

    // Process the message through the conversation agent
    const agentResponse = await getConversationAgent().processMessage(agentContext, message);

    // For now, just send the response as text (not streaming character by character)
    // since agentResponse.content is already a complete string
    
    // Simulate streaming by sending word by word
    const words = agentResponse.content.split(' ');
    let fullResponse = '';
    
    for (const word of words) {
      const chunk = fullResponse === '' ? word : ` ${word}`;
      res.write(chunk);
      fullResponse += chunk;
      
      // Add a small delay to make streaming visible
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Generate embedding for the agent response
    const responseEmbedding = await getEmbeddingService().generateEmbedding(agentResponse.content);

    // Store agent response using RPC function
    await supabase
      .rpc('add_user_chat_message', {
        p_user_id: user_id,
        p_session_id: session_id,
        p_content: agentResponse.content,
        p_sender: 'assistant',
        p_embedding: responseEmbedding
      });

    res.end();

  } catch (error) {
    console.error('Error handling streaming chat:', error);
    res.write('error: Failed to process streaming chat message\n');
    res.end();
  }
}