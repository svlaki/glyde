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
  console.log('🔍 Finding and Removing Duplicate Categories\n');

  try {
    // Get all categories ordered by user, name, and creation date
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('user_id, name, created_at');

    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    console.log(`Total categories: ${categories?.length}\n`);

    // Find duplicates - keep oldest, delete newer ones
    const seen = new Map<string, any>(); // key: user_id + name
    const toDelete: Array<{ id: string; name: string; created: string }> = [];

    for (const cat of categories!) {
      const key = `${cat.user_id}:${cat.name}`;
      const existing = seen.get(key);

      if (existing) {
        // Duplicate found - mark newer one for deletion
        toDelete.push({
          id: cat.id,
          name: cat.name,
          created: new Date(cat.created_at).toLocaleString()
        });
        console.log(`   Duplicate: "${cat.name}" (created: ${new Date(cat.created_at).toLocaleString()})`);
      } else {
        seen.set(key, cat);
      }
    }

    console.log(`\nFound ${toDelete.length} duplicates to remove\n`);

    if (toDelete.length === 0) {
      console.log('No duplicates found!');
      return;
    }

    // Show summary by category name
    const dupCounts = new Map<string, number>();
    toDelete.forEach(d => {
      dupCounts.set(d.name, (dupCounts.get(d.name) || 0) + 1);
    });

    console.log('Duplicates by category:');
    Array.from(dupCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`  - ${name}: ${count} duplicate${count > 1 ? 's' : ''}`);
      });

    console.log('\n About to delete these categories...');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to proceed...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete duplicates in batches
    console.log(' Deleting duplicates...');
    const deleteIds = toDelete.map(d => d.id);

    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .in('id', deleteIds);

    if (deleteError) {
      throw new Error(`Failed to delete duplicates: ${deleteError.message}`);
    }

    console.log(`Successfully deleted ${deleteIds.length} duplicate categories\n`);

    // Verify final count
    const { data: finalCategories } = await supabase
      .from('categories')
      .select('id')
      .order('user_id');

    console.log(`Final category count: ${finalCategories?.length}`);

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main().catch(console.error);
