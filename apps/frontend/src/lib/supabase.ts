import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ [SUPABASE SETUP] Missing required Supabase environment variables')
  throw new Error('Missing required Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    debug: true,
    persistSession: true,
    autoRefreshToken: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-client-info': 'glyde-calendar'
    }
  }
})

supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('❌ [SUPABASE SETUP] Initial session check failed')
  }
}).catch((err) => {
  console.error('❌ [SUPABASE SETUP] Error checking initial session')
})
