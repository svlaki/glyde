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
  let sessionId: string | undefined
  try {
    const body = await req.json()
    userId = body.user_id
    sessionId = body.session_id
    console.log('Request body:', body)
    if (!userId || !sessionId) throw new Error('Missing user_id or session_id in request body')
  } catch (e) {
    console.log('Request parse error:', e)
    return new Response(`Invalid request: ${e.message}`, { status: 400, headers: corsHeaders })
  }

  const client = await pool.connect()
  try {
    const schema = `u_${userId.replace(/-/g, '')}`
    const query = `SELECT * FROM "${schema}"."chat_messages" WHERE session_id = $1 ORDER BY timestamp ASC`;
    console.log('Select query:', query)
    const { rows } = await client.queryObject(query, [sessionId])
    console.log('Select result:', rows)
    return new Response(JSON.stringify({ success: true, messages: rows }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    console.log('DB error:', e)
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } finally {
    client.release()
  }
}) 