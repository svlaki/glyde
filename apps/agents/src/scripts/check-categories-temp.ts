#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Checking categories and events...\n');

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, color, icon, user_id')
    .order('name');

  console.log('Categories in database:');
  console.table(categories?.map(c => ({ name: c.name, color: c.color, icon: c.icon })));

  const { data: events } = await supabase
    .from('events')
    .select(`
      id,
      title,
      category,
      category_id,
      categories (
        name,
        color
      )
    `)
    .order('start_time', { ascending: false })
    .limit(20);

  console.log('\nSample events with categories:');
  console.table(events?.map((e: any) => ({
    title: e.title.substring(0, 30),
    old_category: e.category,
    new_category: e.categories?.name,
    color: e.categories?.color
  })));
}

main().catch(console.error);
