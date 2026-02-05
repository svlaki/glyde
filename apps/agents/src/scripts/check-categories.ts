#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Checking Categories & Events\n');

  // Get all categories
  const { data: categories } = await supabase
    .from('categories')
    .select('name, color, user_id')
    .order('name');

  console.log('🏷️  Available Categories:');
  console.table(categories?.map(c => ({ name: c.name, color: c.color })));

  // Get distinct event categories (old field)
  const { data: events } = await supabase
    .from('events')
    .select('category');

  const uniqueCategories = [...new Set(events?.map(e => e.category).filter(Boolean))];

  console.log('\nEvent Categories (old field):');
  console.table(uniqueCategories.map(c => ({ category: c })));

  // Check for mismatches
  const categoryNames = new Set(categories?.map(c => c.name) || []);
  const mismatches = uniqueCategories.filter(c => !categoryNames.has(c));

  if (mismatches.length > 0) {
    console.log('\n Categories in events but NOT in categories table:');
    console.table(mismatches.map(c => ({ missing: c })));
  }
}

main().catch(console.error);
