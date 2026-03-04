import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve('../../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);
async function run() {
  console.log('Querying table...');
  const { data, error } = await supabase.from('beta_analytics_events').select('*').limit(1);
  console.log('Result:', { data, error });
  
  // Try reloading schema cache
  await supabase.rpc('reload_schema_cache');
}
run();
