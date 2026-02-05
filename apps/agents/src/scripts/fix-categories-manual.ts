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

// Helper to clean emoji from category names
function cleanCategoryName(name: string): string {
  // Remove emojis - this list covers the common ones we saw
  let result = name
    .replace(/[✈️✈👥📚🎬🛒🏋️‍♀️🏋️‍♂️🏋🏋️❤️❤🏥🎨🤝👶]/g, '')
    .replace(/[\u2600-\u27BF]/g, '')  // Misc symbols and emoticons
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')  // Surrogate pairs (extended emojis)
    .trim();

  return result;
}

async function main() {
  console.log('🔧 Manually Fixing Categories\n');

  try {
    // Step 1: Get all categories
    console.log('Step 1: Fetching all categories...');
    const { data: categories, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .order('created_at');

    if (fetchError) {
      throw new Error(`Failed to fetch categories: ${fetchError.message}`);
    }

    console.log(`Found ${categories?.length} categories\n`);

    // Step 2: Clean names and track changes
    console.log('Step 2: Cleaning category names...');
    const updates: Array<{ id: string; oldName: string; newName: string }> = [];

    for (const cat of categories!) {
      const cleaned = cleanCategoryName(cat.name);
      if (cleaned !== cat.name) {
        updates.push({
          id: cat.id,
          oldName: cat.name,
          newName: cleaned
        });
      }
    }

    console.log(`Found ${updates.length} categories to clean:`);
    updates.forEach(u => console.log(`  - "${u.oldName}" → "${u.newName}"`));
    console.log();

    // Check if cleaned names would conflict with existing categories
    console.log('🔍 Checking for conflicts after cleaning...');
    const toDelete: string[] = [];

    for (const update of updates) {
      // Check if a category with the cleaned name already exists for this user
      const cat = categories!.find(c => c.id === update.id);
      const existing = categories!.find(
        c => c.user_id === cat?.user_id &&
        c.name === update.newName &&
        c.id !== update.id
      );

      if (existing) {
        console.log(`  - Conflict: "${update.oldName}" → "${update.newName}" (already exists, will delete emoji version)`);
        toDelete.push(update.id);
      } else {
        // Safe to update
        const { error } = await supabase
          .from('categories')
          .update({ name: update.newName })
          .eq('id', update.id);

        if (error) {
          console.error(`  - Failed to update ${update.id}:`, error.message);
        }
      }
    }

    // Delete emoji versions that conflict
    if (toDelete.length > 0) {
      console.log(`\n Deleting ${toDelete.length} emoji categories that conflict...`);
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .in('id', toDelete);

      if (deleteError) {
        console.error(`  - Delete failed:`, deleteError.message);
      } else {
        console.log('Emoji conflicting categories deleted');
      }
    }

    console.log('Names cleaned\n');

    // Step 3: Find and remove remaining duplicates
    console.log('🔍 Step 3: Finding remaining duplicates...');
    const { data: refreshedCategories } = await supabase
      .from('categories')
      .select('*')
      .order('user_id, name, created_at');

    const seen = new Map<string, string>(); // key: user_id + name, value: id to keep
    const moreDuplicates: string[] = [];

    for (const cat of refreshedCategories!) {
      const key = `${cat.user_id}:${cat.name}`;
      if (seen.has(key)) {
        // Duplicate found - mark for deletion
        moreDuplicates.push(cat.id);
        console.log(`  - Duplicate: "${cat.name}" (keeping older entry)`);
      } else {
        seen.set(key, cat.id);
      }
    }

    console.log(`\nFound ${moreDuplicates.length} duplicates to remove\n`);

    // Delete duplicates
    if (moreDuplicates.length > 0) {
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .in('id', moreDuplicates);

      if (deleteError) {
        throw new Error(`Failed to delete duplicates: ${deleteError.message}`);
      }
      console.log('Duplicates removed\n');
    }

    // Step 4: Update all icons to capital letters
    console.log('🔤 Step 4: Updating icons to capital letters...');
    const { data: finalCategories } = await supabase
      .from('categories')
      .select('*');

    for (const cat of finalCategories!) {
      const icon = cat.name.charAt(0).toUpperCase();
      const { error } = await supabase
        .from('categories')
        .update({ icon })
        .eq('id', cat.id);

      if (error) {
        console.error(`Failed to update icon for ${cat.name}:`, error);
      }
    }

    console.log('All icons updated\n');

    // Step 5: Show final results
    console.log('Final Results:\n');
    const { data: final } = await supabase
      .from('categories')
      .select('name, icon, color')
      .order('name')
      .limit(30);

    console.table(final?.map(c => ({
      name: c.name,
      icon: c.icon,
      color: c.color
    })));

    console.log('\nCategory fix complete!');

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main().catch(console.error);
