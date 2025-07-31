import express from 'express';
import cors from 'cors';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { AgentServiceClient } from '../services/AgentServiceClient.js';
import { agentRouter } from '../services/AgentRouter.js';

// Use direct connection to agent service
const agentServiceClient = new AgentServiceClient('http://localhost:8000');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat/stream', async (req, res) => {
  try {
    console.log('📨 Received chat request:', { body: req.body });
    
    // Extract messages from the request body - useChat sends them directly
    const messages = req.body.messages || [];
    const userId = req.body.userId;

    if (!userId) {
      console.error('❌ No userId provided');
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get the current user message
    const currentMessage = messages[messages.length - 1]?.content || '';
    console.log('💬 Current message:', currentMessage);
    
    // Analyze message to determine appropriate agent
    const routeAnalysis = agentRouter.analyzeMessage(currentMessage);
    console.log(`🤖 Routing to ${routeAnalysis.primaryAgent} agent (confidence: ${routeAnalysis.confidence.toFixed(2)})`);
    
    // Get system prompt from agent service
    let systemPrompt = '';
    try {
      systemPrompt = await agentServiceClient.getSystemPrompt(userId);
      console.log('📋 System prompt loaded');
    } catch (error) {
      console.error('⚠️ Failed to load system prompt:', error);
      systemPrompt = 'You are a helpful AI assistant for a personal productivity system.';
    }

    const result = await streamText({
      model: openai('gpt-4o-mini'),
      messages,
      tools: {
        delegate_to_agent: {
          description: 'Delegate request to appropriate specialized agent based on message content',
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'The user message to process' },
              agentType: { 
                type: 'string', 
                description: 'Optional specific agent to route to',
                enum: ['conversation', 'scheduling', 'coaching', 'pattern_mining', 'proactive']
              }
            },
            required: ['message']
          },
          execute: async ({ message, agentType }) => {
            console.log(`🛠️ Tool execute called with message: "${message}", agentType: ${agentType}`);
            try {
              // Use router analysis or explicit agent type
              const targetAgent = agentType || routeAnalysis.primaryAgent;
              
              console.log(`🔄 Delegating to ${targetAgent} agent: "${message.substring(0, 50)}..."`);
              
              const agentResponse = await agentServiceClient.routeMessage(
                userId, 
                message, 
                'default', 
                targetAgent
              );
              
              console.log(`✅ Agent response from ${targetAgent}: ${agentResponse.content.substring(0, 100)}...`);
              
              // Add agent metadata to response
              const responseWithMetadata = `🤖 **${targetAgent.charAt(0).toUpperCase() + targetAgent.slice(1)} Agent**\n\n${agentResponse.content}`;
              
              return responseWithMetadata;
            } catch (error) {
              console.error('❌ Error delegating to agent:', error);
              console.error('❌ Error details:', error.message);
              console.error('❌ Error stack:', error.stack);
              return `I apologize, but I'm having trouble connecting to the agent service. Let me help you directly instead!\n\nYou said: "${message}"`;
            }
          }
        },
        analyze_message: {
          description: 'Analyze message intent and suggest appropriate agent',
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Message to analyze' }
            },
            required: ['message']
          },
          execute: async ({ message }) => {
            const analysis = agentRouter.analyzeMessage(message);
            return `**Message Analysis:**
- **Primary Agent:** ${analysis.primaryAgent}
- **Confidence:** ${(analysis.confidence * 100).toFixed(1)}%
- **Reasoning:** ${analysis.reasoning}
- **Alternative Agents:** ${analysis.alternativeAgents.join(', ')}`;
          }
        }
      },
      system: `${systemPrompt}

**Agent Routing Context:**
- Primary agent suggested: ${routeAnalysis.primaryAgent}
- Confidence: ${(routeAnalysis.confidence * 100).toFixed(1)}%
- Reasoning: ${routeAnalysis.reasoning}

You have access to a sophisticated multi-agent system. Use the delegate_to_agent tool to route requests to specialized agents:
- **conversation**: General orchestration and complex queries
- **scheduling**: Calendar management and event planning
- **coaching**: Goal setting, habit tracking, and personal development
- **pattern_mining**: Data analysis and behavioral insights
- **proactive**: Suggestions and recommendations

Always delegate to the most appropriate agent based on the user's request.`,
      
      onFinish: async ({ text, toolCalls }) => {
        // Store conversation via agent service
        try {
          console.log('💾 Storing conversation to agent service');
          // The agent service will handle storing messages with embeddings
          await agentServiceClient.routeMessage(
            userId, 
            `Store conversation: User: ${currentMessage}, Assistant: ${text}`,
            'default',
            'conversation'
          );
        } catch (error) {
          console.error('Failed to store conversation:', error);
        }
      }
    });

    // Convert to AI SDK compatible response
    console.log('🔄 Starting stream...');
    result.pipeDataStreamToResponse(res);
    
  } catch (error) {
    console.error('❌ Chat API error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Streaming chat server running on port ${PORT}`);
});

export default app;