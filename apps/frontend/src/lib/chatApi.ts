import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Simple API handler for useChat
export async function POST(request: Request) {
  try {
    const { messages, userId } = await request.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await streamText({
      model: openai('gpt-4o-mini'),
      messages,
      system: `You are a helpful AI assistant for a personal productivity system. 
      Help users with calendar management, task organization, and productivity advice.
      
      Current user: ${userId}`,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}