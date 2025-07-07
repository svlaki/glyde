// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts"
import * as postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
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
        model: 'text-embedding-ada-002',
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

export default serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  let userId: string | undefined
  let event: any | undefined
  try {
    const body = await req.json()
    userId = body.user_id
    event = body.event
    if (!userId || !event) throw new Error('Missing user_id or event in request body')
    // Normalize event fields to support both snake_case and camelCase
    event = {
      title: event.title || event.event_title,
      starts_at: event.starts_at || event.event_starts_at,
      ends_at: event.ends_at || event.event_ends_at,
      location: event.location || event.event_location,
      description: event.description || event.event_description,
      id: event.id
    }
    if (!event.title || !event.starts_at || !event.ends_at) {
      throw new Error('Missing required event fields (title, starts_at, ends_at)')
    }
  } catch (e) {
    return new Response(`Invalid request: ${e.message}`, { status: 400, headers: corsHeaders })
  }

  const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openAIApiKey) {
    return new Response('OPENAI_API_KEY is not set', { status: 500, headers: corsHeaders })
  }

  const eventText = `${event.title}, ${new Date(event.starts_at).toLocaleString()} to ${new Date(event.ends_at).toLocaleString()}`
  const embedding = await generateEmbedding(eventText, openAIApiKey)

  const client = await pool.connect()
  try {
    const schema = `u_${userId.replace(/-/g, '')}`
    if (event.id) {
      // Update event
      const query = `UPDATE "${schema}"."events" SET event_title = $1, event_starts_at = $2, event_ends_at = $3, event_location = $4, event_description = $5, embedding = $6::vector WHERE id = $7 RETURNING id`;
      await client.queryObject(query, [event.title, event.starts_at, event.ends_at, event.location, event.description, embedding ? `[${embedding.join(',')}]` : null, event.id])
    } else {
      // Create event
      const query = `INSERT INTO "${schema}"."events" (event_title, event_starts_at, event_ends_at, event_location, event_description, embedding) VALUES ($1, $2, $3, $4, $5, $6::vector) RETURNING id`;
      await client.queryObject(query, [event.title, event.starts_at, event.ends_at, event.location, event.description, embedding ? `[${embedding.join(',')}]` : null])
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } finally {
    client.release()
  }
})
