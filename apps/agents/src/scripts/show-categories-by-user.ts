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
  console.log('📋 Categories by User\n');

  // Get all categories with user_id
  const { data: categories } = await supabase
    .from('categories')
    .select('name, icon, color, user_id, created_at')
    .order('user_id, name, created_at');

  // Group by user
  const byUser = new Map<string, any[]>();
  categories?.forEach(c => {
    const userCats = byUser.get(c.user_id) || [];
    userCats.push(c);
    byUser.set(c.user_id, userCats);
  });

  // Show each user's categories
  for (const [userId, userCats] of byUser.entries()) {
    console.log(`\n👤 User: ${userId.substring(0, 8)}... (${userCats.length} categories)`);

    // Find duplicates for this user
    const nameCounts = new Map<string, number>();
    userCats.forEach(c => {
      nameCounts.set(c.name, (nameCounts.get(c.name) || 0) + 1);
    });

    const dups = Array.from(nameCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([name, count]) => ({ name, count }));

    if (dups.length > 0) {
      console.log('  ⚠️  Duplicates:');
      dups.forEach(d => console.log(`    - ${d.name}: ${d.count}x`));
    } else {
      console.log('  ✅ No duplicates');
    }
  }

  console.log('\n\n📊 Summary:');
  console.log(`Total users: ${byUser.size}`);
  console.log(`Total categories: ${categories?.length}`);
}

main().catch(console.error);
