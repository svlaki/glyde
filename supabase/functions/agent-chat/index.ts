// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts"
import * as postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const databaseUrl = Deno.env.get('SUPABASE_DB_URL')
if (!databaseUrl) throw new Error('SUPABASE_DB_URL env var is required')
const pool = new postgres.Pool(databaseUrl, 3, true)

async function generateEmbedding(input: string, apiKey: string): Promise<number[] | null> {
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.[0]?.embedding || null
  } catch {
    return null
  }
}

async function generateAgentResponse(
  userMessage: string,
  userId: string,
  sessionId: string,
  conversationHistory: any[],
  relevantEvents: any[],
  apiKey: string
): Promise<string> {
  const systemPrompt = `You are a helpful AI assistant integrated with a calendar and task management system. You have access to the user's calendar events and can help with scheduling, planning, and productivity.

Current context:
- User ID: ${userId}
- Session: ${sessionId}
- Time: ${new Date().toISOString()}

Recent relevant events:
${relevantEvents.map(e => `- ${e.event_title} (${e.event_starts_at} to ${e.event_ends_at})`).join('\n')}

Conversation history:
${conversationHistory.slice(-5).map(msg => `${msg.sender}: ${msg.content}`).join('\n')}

Be helpful, concise, and proactive. If the user asks about scheduling or calendar-related topics, reference their actual events.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || "I'm sorry, I couldn't process your request."
  } catch (error) {
    console.error('Error generating response:', error)
    return "I'm experiencing some technical difficulties. Please try again."
  }
}

export default serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  let userId: string | undefined
  let message: string | undefined
  let sessionId: string | undefined

  try {
    const body = await req.json()
    userId = body.user_id
    message = body.message
    sessionId = body.session_id
    
    if (!userId || !message || !sessionId) {
      throw new Error('Missing user_id, message, or session_id in request body')
    }
  } catch (e) {
    return new Response(`Invalid request: ${e.message}`, { status: 400, headers: corsHeaders })
  }

  const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openAIApiKey) {
    return new Response('OPENAI_API_KEY is not set', { status: 500, headers: corsHeaders })
  }

  const client = await pool.connect()
  try {
    const schema = `u_${userId.replace(/-/g, '')}`
    
    // Generate embedding for user message
    const userEmbedding = await generateEmbedding(message, openAIApiKey)
    const userEmbeddingLiteral = userEmbedding ? `[${userEmbedding.join(',')}]` : null
    
    // Store user message with embedding
    await client.queryObject(
      `INSERT INTO "${schema}"."chat_messages" (content, sender, session_id, user_id, embedding, timestamp) VALUES ($1, $2, $3, $4, $5::vector, NOW())`,
      [message, 'user', sessionId, userId, userEmbeddingLiteral]
    )

    // Get conversation history
    const historyResult = await client.queryObject<any>(
      `SELECT * FROM "${schema}"."chat_messages" WHERE session_id = $1 ORDER BY timestamp DESC LIMIT 10`,
      [sessionId]
    )
    const conversationHistory = historyResult.rows.reverse()

    // Get relevant events (recent and upcoming)
    const eventsResult = await client.queryObject<any>(
      `SELECT * FROM "${schema}"."events" WHERE event_starts_at >= NOW() - INTERVAL '7 days' AND event_starts_at <= NOW() + INTERVAL '30 days' ORDER BY event_starts_at LIMIT 20`,
      []
    )
    const relevantEvents = eventsResult.rows

    // Generate AI response
    const aiResponse = await generateAgentResponse(
      message,
      userId,
      sessionId,
      conversationHistory,
      relevantEvents,
      openAIApiKey
    )

    // Generate embedding for AI response
    const responseEmbedding = await generateEmbedding(aiResponse, openAIApiKey)
    const responseEmbeddingLiteral = responseEmbedding ? `[${responseEmbedding.join(',')}]` : null

    // Store AI response with embedding
    const responseResult = await client.queryObject<{ id: string }>(
      `INSERT INTO "${schema}"."chat_messages" (content, sender, session_id, user_id, embedding, timestamp) VALUES ($1, $2, $3, $4, $5::vector, NOW()) RETURNING id`,
      [aiResponse, 'assistant', sessionId, userId, responseEmbeddingLiteral]
    )

    return new Response(JSON.stringify({ 
      success: true, 
      response: aiResponse,
      id: responseResult.rows[0]?.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    console.error('Error:', e)
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } finally {
    client.release()
  }
})