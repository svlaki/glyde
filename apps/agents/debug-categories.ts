#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: events } = await supabase
    .from('events')
    .select('user_id')
    .limit(1);
  
  const userId = events?.[0]?.user_id;
  
  console.log('🔍 Debugging - User ID:', userId, '\n');

  const { data: rpcEvents, error } = await supabase
    .rpc('get_events_with_categories', {
      p_user_id: userId,
      p_start_date: null,
      p_end_date: null
    });

  if (error) {
    console.error('RPC Error:', error);
    return;
  }

  console.log('Events from RPC (first 10):');
  console.table(rpcEvents?.slice(0, 10).map((e: any) => ({
    title: e.title?.substring(0, 25),
    cat_id: e.category_id?.substring(0, 8) || 'NULL',
    cat_name: e.category_name || 'NULL',
    cat_color: e.category_color || 'NULL',
  })));
  
  console.log('\nAll events showing as Personal? Count by color:');
  const colorCounts = rpcEvents?.reduce((acc: any, e: any) => {
    const color = e.category_color || 'NULL';
    acc[color] = (acc[color] || 0) + 1;
    return acc;
  }, {});
  console.table(Object.entries(colorCounts || {}).map(([color, count]) => ({ Color: color, Count: count })));
}

main().catch(console.error);
