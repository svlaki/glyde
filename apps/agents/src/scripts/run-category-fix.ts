#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔧 Running Category Consolidation Fix\n');

  // Read the migration file
  const migrationPath = resolve(__dirname, '../../../../supabase/migrations/20250113000000_consolidate_categories_fix.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('Executing migration...\n');

  try {
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }

    console.log('Migration completed successfully!\n');

    // Check results
    console.log('Checking results...\n');

    const { data: categories } = await supabase
      .from('categories')
      .select('name, icon, color')
      .order('name')
      .limit(20);

    console.log('Sample categories after fix:');
    console.table(categories?.map(c => ({
      name: c.name,
      icon: c.icon,
      color: c.color
    })));

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main().catch(console.error);
