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
  console.log('Checking Categories Detail\n');

  // Get all categories with ALL fields
  const { data: categories } = await supabase
    .from('categories')
    .select('name, icon, color, user_id, created_at')
    .order('name');

  console.log('🏷️  All Categories:');
  console.table(categories?.map(c => ({
    name: c.name,
    icon: c.icon || '(null)',
    color: c.color,
    created: new Date(c.created_at).toLocaleString()
  })));

  // Find duplicates
  const nameCount = new Map<string, number>();
  categories?.forEach(c => {
    const count = nameCount.get(c.name) || 0;
    nameCount.set(c.name, count + 1);
  });

  const duplicates = Array.from(nameCount.entries())
    .filter(([_, count]) => count > 1)
    .map(([name, count]) => ({ name, count }));

  if (duplicates.length > 0) {
    console.log('\n Duplicate Categories:');
    console.table(duplicates);
  }

  // Find categories with emojis
  const withEmojis = categories?.filter(c => {
    // Simple emoji detection
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{2300}-\u{23FF}]/u;
    return emojiRegex.test(c.name);
  });

  if (withEmojis && withEmojis.length > 0) {
    console.log('\nCategories with Emojis in Name:');
    console.table(withEmojis.map(c => ({ name: c.name, icon: c.icon })));
  }

  // Find categories with missing or emoji icons
  const badIcons = categories?.filter(c => {
    if (!c.icon || c.icon === '') return true;
    // Check if icon is a single capital letter
    return !/^[A-Z]$/.test(c.icon);
  });

  if (badIcons && badIcons.length > 0) {
    console.log('\n🚫 Categories with Invalid Icons (should be single capital letter):');
    console.table(badIcons.map(c => ({ name: c.name, icon: c.icon || '(null)' })));
  }
}

main().catch(console.error);
