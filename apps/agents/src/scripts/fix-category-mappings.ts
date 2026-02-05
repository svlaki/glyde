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

const CATEGORY_MAPPINGS: Record<string, string> = {
  'Fitness': 'Exercise',
  'Health & Hygiene': 'Health',
  'School': 'Learning',
  'Learning': 'Learning',
  'Mendicants': 'Mendicants',
};

async function main() {
  console.log('Fixing Category Mappings\n');

  let totalFixed = 0;

  for (const [oldName, newName] of Object.entries(CATEGORY_MAPPINGS)) {
    console.log(`\n🔧 Mapping "${oldName}" → "${newName}"...`);

    // Get events with old category name
    const { data: events } = await supabase
      .from('events')
      .select('id, user_id, category')
      .eq('category', oldName);

    if (!events || events.length === 0) {
      console.log(`   ℹ️  No events found with category "${oldName}"`);
      continue;
    }

    console.log(`   Found ${events.length} events to update`);

    let updated = 0;
    for (const event of events) {
      // Find the correct category_id for this user
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', event.user_id)
        .eq('name', newName)
        .maybeSingle();

      if (category) {
        const { error } = await supabase
          .from('events')
          .update({ category_id: category.id })
          .eq('id', event.id);

        if (!error) {
          updated++;
        }
      }
    }

    console.log(`   Updated ${updated}/${events.length} events`);
    totalFixed += updated;
  }

  console.log(`\nTotal events fixed: ${totalFixed}`);
  console.log('Refresh your calendar to see the correct colors!\n');

  // Show summary
  const { data: summary } = await supabase
    .from('events')
    .select(`
      id,
      title,
      category,
      categories (
        name,
        color
      )
    `)
    .not('category_id', 'is', null)
    .order('start_time', { ascending: false })
    .limit(10);

  if (summary) {
    console.log('Sample of events with updated categories:');
    console.table(
      summary.map((e: any) => ({
        title: e.title.substring(0, 30),
        old_category: e.category,
        new_category: e.categories?.name,
        color: e.categories?.color
      }))
    );
  }
}

main().catch(console.error);
