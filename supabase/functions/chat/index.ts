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
  let embedding: number[] | null | undefined
  try {
    const body = await req.json()
    userId = body.user_id
    message = body.message
    sessionId = body.session_id
    embedding = body.embedding
    console.log('Request body:', { user_id: body.user_id, content_length: body.message?.length })
    if (!userId || !message || !sessionId) throw new Error('Missing user_id, message, or session_id in request body')
  } catch (e) {
    console.log('Request parse error:', e)
    return new Response(`Invalid request: ${e.message}`, { status: 400, headers: corsHeaders })
  }

  // Convert embedding array to Postgres vector literal
  let embeddingLiteral: string | null = null
  if (Array.isArray(embedding)) {
    embeddingLiteral = `[${embedding.join(',')}]`
  }

  const client = await pool.connect()
  try {
    // Insert the message into the user's chat_messages table
    const schema = `u_${userId.replace(/-/g, '')}`
    const query = `INSERT INTO "${schema}"."chat_messages" (content, sender, session_id, user_id, embedding, timestamp) VALUES ($1, $2, $3, $4, $5::vector, NOW()) RETURNING id`;
    console.log('Insert query:', query)
    const { rows } = await client.queryObject<{ id: number }>(query, [message, 'user', sessionId, userId, embeddingLiteral])
    console.log('Insert result:', { rows_inserted: rows?.length })
    return new Response(JSON.stringify({ success: true, id: rows[0]?.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    console.log('DB error:', e)
    console.log('Error details:', { schema: `u_${userId?.replace(/-/g, '')}`, embedding: embeddingLiteral?.substring(0, 50) + '...' })
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } finally {
    client.release()
  }
}) 