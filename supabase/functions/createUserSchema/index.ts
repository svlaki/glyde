// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts"
import * as postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Get the connection string from the environment variable
const databaseUrl = Deno.env.get('SUPABASE_DB_URL')

if (!databaseUrl) throw new Error('SUPABASE_DB_URL env var is required')

const pool = new postgres.Pool(databaseUrl, 3, true)

export default serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  let userId: string | undefined
  let userEmail: string | undefined
  try {
    const body = await req.json()
    userId = body.user_id
    userEmail = body.user_email
    if (!userId || !userEmail) throw new Error('Missing user_id or user_email in request body')
  } catch (e) {
    return new Response(`Invalid request: ${e.message}`, { status: 400, headers: corsHeaders })
  }

  const client = await pool.connect()
  try {
    // Call the RPC to create all per-user tables in the schema
    const { rows } = await client.queryObject<{ create_user_schema_rpc: boolean }>(
      'SELECT public.create_user_schema_rpc($1::uuid, $2::text) as create_user_schema_rpc',
      [userId, userEmail]
    )
    const success = rows[0]?.create_user_schema_rpc === true
    if (!success) throw new Error('RPC failed or returned false')
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
