#!/usr/bin/env tsx

/**
 * Script to fix event category_id relationships
 *
 * This script:
 * 1. Checks how many events are missing category_id
 * 2. Updates events to have correct category_id based on category name
 * 3. Sets default "Personal" category for events with no category
 * 4. Verifies the fix worked
 *
 * Usage:
 *   tsx scripts/fix-event-categories.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('🔍 Event Category ID Fix Script');
  console.log('================================\n');

  if (isDryRun) {
    console.log('Running in DRY RUN mode - no changes will be made\n');
  }

  // Step 1: Check current state
  console.log('Step 1: Checking current state of events...');
  const { data: allEvents } = await supabase
    .from('events')
    .select('id, category_id, category, user_id');

  const total = allEvents?.length || 0;
  const withCategoryId = allEvents?.filter(e => e.category_id).length || 0;
  const missing = total - withCategoryId;

  console.log(`   Total events: ${total}`);
  console.log(`   Events with category_id: ${withCategoryId}`);
  console.log(`   Events missing category_id: ${missing}\n`);

  if (missing === 0) {
    console.log('All events already have category_id set!');
    return;
  }

  // Step 2: Show sample of problematic events
  console.log('Step 2: Sample of events missing category_id...');
  const { data: sampleEvents, error: sampleError } = await supabase
    .from('events')
    .select('id, title, category, category_id, start_time')
    .is('category_id', null)
    .limit(5);

  if (sampleError) {
    console.error('Error fetching sample events:', sampleError);
  } else {
    console.table(sampleEvents);
  }

  if (isDryRun) {
    console.log('\nDry run mode - stopping here. Run without --dry-run to apply fixes.');
    return;
  }

  // Step 3: Fix events with category names
  console.log('\n🔧 Step 3: Updating events with category names...');

  // Get all events missing category_id but with category name
  const { data: eventsToFix } = await supabase
    .from('events')
    .select('id, user_id, category')
    .is('category_id', null)
    .not('category', 'is', null);

  if (eventsToFix && eventsToFix.length > 0) {
    let updated = 0;

    for (const event of eventsToFix) {
      // Find matching category for this user
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', event.user_id)
        .eq('name', event.category)
        .single();

      if (category) {
        // Update event with category_id
        const { error: updateError } = await supabase
          .from('events')
          .update({ category_id: category.id })
          .eq('id', event.id);

        if (!updateError) {
          updated++;
        }
      }
    }

    console.log(`   Updated ${updated} events based on category name`);
  } else {
    console.log('   ℹ️ No events to update');
  }

  // Step 4: Set default Personal category for remaining events
  console.log('\n🔧 Step 4: Setting "Personal" category for events without category...');

  const { data: remainingEvents } = await supabase
    .from('events')
    .select('id, user_id')
    .is('category_id', null);

  if (remainingEvents && remainingEvents.length > 0) {
    let defaulted = 0;

    for (const event of remainingEvents) {
      // Find Personal category for this user
      const { data: personalCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', event.user_id)
        .eq('name', 'Personal')
        .single();

      if (personalCategory) {
        const { error: updateError } = await supabase
          .from('events')
          .update({ category_id: personalCategory.id })
          .eq('id', event.id);

        if (!updateError) {
          defaulted++;
        }
      }
    }

    console.log(`   Set Personal category for ${defaulted} remaining events`);
  } else {
    console.log('   ℹ️ No remaining events without category');
  }

  // Step 5: Verify the fix
  console.log('\nStep 5: Verifying the fix...');
  const { data: verifyEvents } = await supabase
    .from('events')
    .select('id, category_id');

  const totalAfter = verifyEvents?.length || 0;
  const withCategoryIdAfter = verifyEvents?.filter(e => e.category_id).length || 0;
  const missingAfter = totalAfter - withCategoryIdAfter;

  console.log(`   Total events: ${totalAfter}`);
  console.log(`   Events with category_id: ${withCategoryIdAfter}`);
  console.log(`   Events still missing category_id: ${missingAfter}\n`);

  // Step 6: Show sample of fixed events
  console.log('Step 6: Sample of events with categories...');
  const { data: fixedSample } = await supabase
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
    .not('category_id', 'is', null)
    .order('start_time', { ascending: false })
    .limit(5);

  if (fixedSample) {
    console.table(
      fixedSample.map((e: any) => ({
        id: e.id.substring(0, 8),
        title: e.title,
        old_category: e.category,
        new_category: e.categories?.name,
        color: e.categories?.color
      }))
    );
  }

  console.log('\nEvent category fix complete!');
  console.log('Refresh your calendar to see the updated colors.');
}

main().catch(console.error);
