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

interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  created_at: string;
}

async function consolidateCategories() {
  console.log('🏷️  Starting category consolidation...\n');

  try {
    // Get all users with categories
    const { data: users, error: usersError } = await supabase
      .from('categories')
      .select('user_id', { count: 'exact' })
      .then(result => ({
        data: [...new Set((result.data || []).map(c => (c as any).user_id))],
        error: result.error
      }));

    if (usersError) throw usersError;

    let totalDuplicatesRemoved = 0;
    let totalIconsFixed = 0;

    for (const userId of users || []) {
      // Get all categories for this user
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }) as { data: Category[]; error: any };

      if (catError) {
        console.error(`Error fetching categories for user ${userId}:`, catError);
        continue;
      }

      // Find duplicates (same name, keep first by created_at)
      const nameMap = new Map<string, Category[]>();
      for (const cat of categories || []) {
        if (!nameMap.has(cat.name)) {
          nameMap.set(cat.name, []);
        }
        nameMap.get(cat.name)!.push(cat);
      }

      // Remove duplicates
      for (const [name, cats] of nameMap) {
        if (cats.length > 1) {
          const toDelete = cats.slice(1);
          for (const cat of toDelete) {
            const { error: delError } = await supabase
              .from('categories')
              .delete()
              .eq('id', cat.id);

            if (delError) {
              console.error(`Failed to delete duplicate "${name}" (${cat.id}):`, delError);
            } else {
              console.log(`✓ Removed duplicate: "${name}"`);
              totalDuplicatesRemoved++;
            }
          }
        }
      }

      // Fix icons (ensure capital letters)
      for (const cat of categories || []) {
        let newIcon = cat.icon;

        // Generate icon from first letter if missing or invalid
        if (!newIcon || newIcon.length !== 1 || !/^[A-Z]$/.test(newIcon)) {
          newIcon = cat.name.charAt(0).toUpperCase();

          const { error: updateError } = await supabase
            .from('categories')
            .update({ icon: newIcon })
            .eq('id', cat.id);

          if (updateError) {
            console.error(`Failed to update icon for "${cat.name}":`, updateError);
          } else {
            console.log(`✓ Fixed icon for "${cat.name}": ${newIcon}`);
            totalIconsFixed++;
          }
        }
      }
    }

    console.log('\nConsolidation complete!');
    console.log(`   - Duplicates removed: ${totalDuplicatesRemoved}`);
    console.log(`   - Icons fixed: ${totalIconsFixed}`);

  } catch (error) {
    console.error('Consolidation failed:', error);
    process.exit(1);
  }
}

consolidateCategories().catch(console.error);
