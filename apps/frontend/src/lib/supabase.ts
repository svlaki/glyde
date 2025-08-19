import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug environment variables
console.log('🔧 [SUPABASE SETUP] Environment Variables:')
console.log('  - URL:', supabaseUrl)
console.log('  - Anon Key:', supabaseAnonKey ? `Found (${supabaseAnonKey.substring(0, 20)}...)` : 'MISSING')
console.log('  - All import.meta.env:', import.meta.env)

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ [SUPABASE SETUP] Missing Supabase environment variables!')
  console.error('  - VITE_SUPABASE_URL:', supabaseUrl || 'UNDEFINED')
  console.error('  - VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '[REDACTED]' : 'UNDEFINED')
  throw new Error('Missing required Supabase environment variables')
}

console.log('🚀 [SUPABASE SETUP] Creating Supabase client...')
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    debug: true,
    persistSession: true,
    autoRefreshToken: true
  }
})

console.log('✅ [SUPABASE SETUP] Supabase client created successfully')
console.log('  - Client auth config:', supabase.auth)

// Test the client immediately
console.log('🔍 [SUPABASE SETUP] Testing client connection...')
supabase.auth.getSession().then(({ data, error }) => {
  console.log('🔍 [SUPABASE SETUP] Initial session check:', { data, error })
}).catch((err) => {
  console.error('❌ [SUPABASE SETUP] Error checking initial session:', err)
}) 