import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const env = fs.readFileSync(envPath, 'utf8');

let url = '';
let key = '';

env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);
async function run() {
  const { data, error } = await supabase.from('beta_analytics_events').select('*').limit(1);
  console.log('Select Result:', { data, error });
  
  // Also try to hit RPC to reload schema cache if possible
  const { data: rpcData, error: rpcError } = await supabase.rpc('reload_schema_cache');
}
run();
