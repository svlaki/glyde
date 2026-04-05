/**
 * Creates and cleans up test users in Supabase for eval runs.
 * Uses service_role_key to bypass RLS.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import type { TestUser } from './types.js';

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key);
}

/**
 * Create a test user with a minimal profile row.
 * Returns the userId and a cleanup function that removes all data.
 */
export async function createTestUser(characterName: string, timezone: string): Promise<TestUser> {
  const client = getClient();
  const userId = randomUUID();

  const { error } = await client.from('profile').insert({
    id: userId,
    email: `eval-${userId.slice(0, 8)}@test.glyde.dev`,
    display_name: characterName,
    timezone,
    onboarding_complete: false,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  console.log(`  [test-user] Created user ${characterName} (${userId.slice(0, 8)}...)`);

  const cleanup = async () => {
    await cleanupTestUser(userId);
  };

  return { userId, cleanup };
}

/**
 * Delete all data for a test user across all tables, in dependency order.
 */
async function cleanupTestUser(userId: string): Promise<void> {
  const client = getClient();

  // Tables in dependency order (children first)
  const tables = [
    'placement_slots',
    'slot_feedback',
    'action_suggestions',
    'events',
    'tasks',
    'goals',
    'notes',
    'aspects',
    'activity_log',
    'agent_token_usage',
    'profile',
  ];

  for (const table of tables) {
    const { error } = await client
      .from(table)
      .delete()
      .eq('user_id', userId);

    if (error) {
      // Profile uses 'id' not 'user_id'
      if (table === 'profile') {
        const { error: profileError } = await client
          .from('profile')
          .delete()
          .eq('id', userId);
        if (profileError) {
          console.warn(`  [cleanup] Failed to delete from profile: ${profileError.message}`);
        }
      } else {
        console.warn(`  [cleanup] Failed to delete from ${table}: ${error.message}`);
      }
    }
  }

  console.log(`  [test-user] Cleaned up user ${userId.slice(0, 8)}...`);
}

/**
 * Snapshot the final state of a test user after the pipeline runs.
 */
export async function snapshotUserState(userId: string) {
  const client = getClient();

  const [
    { data: aspects },
    { data: events },
    { data: tasks },
    { data: goals },
    { data: suggestions },
    { data: slots },
  ] = await Promise.all([
    client.from('aspects').select('*').eq('user_id', userId),
    client.from('events').select('*').eq('user_id', userId).order('start_time', { ascending: true }),
    client.from('tasks').select('*').eq('user_id', userId),
    client.from('goals').select('*').eq('user_id', userId),
    client.from('action_suggestions').select('*').eq('user_id', userId),
    client.from('placement_slots').select('*').eq('user_id', userId).order('start_time', { ascending: true }),
  ]);

  const allEvents = events || [];
  const recurring = allEvents.filter((e: any) => e.rrule_string);
  const oneTime = allEvents.filter((e: any) => !e.rrule_string);

  return {
    aspects: aspects || [],
    events: oneTime,
    recurringEvents: recurring,
    tasks: tasks || [],
    goals: goals || [],
    suggestions: suggestions || [],
    placementSlots: slots || [],
  };
}
