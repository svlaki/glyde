/**
 * Creates and cleans up test users in Supabase for eval runs.
 * Uses service_role_key to bypass RLS.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { TestUser, TokenUsage } from './types.js';

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key);
}

/**
 * Create a test user with an auth.users entry and a profile row.
 * Returns the userId and a cleanup function that removes all data.
 */
export async function createTestUser(characterName: string, timezone: string): Promise<TestUser> {
  const client = getClient();
  const email = `eval-${randomUUID().slice(0, 8)}@test.glyde.dev`;

  // Create auth user first (profile.id has FK to auth.users)
  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: characterName },
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create auth user: ${authError?.message || 'no user returned'}`);
  }

  const userId = authData.user.id;

  // Upsert profile (trigger may auto-create it)
  const { error: profileError } = await client.from('profile').upsert({
    id: userId,
    email,
    display_name: characterName,
    timezone,
  });

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`);
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
    'user_activity_log',
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

  // Delete auth user last
  const { error: authError } = await client.auth.admin.deleteUser(userId);
  if (authError) {
    console.warn(`  [cleanup] Failed to delete auth user: ${authError.message}`);
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
  const recurring = allEvents.filter((e: any) => e.recurrence_rule || e.is_recurring);
  const oneTime = allEvents.filter((e: any) => !e.recurrence_rule && !e.is_recurring);

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

/**
 * Get total token usage for a test user from agent_token_usage table.
 */
export async function getTokenUsage(userId: string): Promise<TokenUsage> {
  const client = getClient();

  const { data } = await client
    .from('agent_token_usage')
    .select('input_tokens, output_tokens, total_tokens, model_calls')
    .eq('user_id', userId);

  if (!data || data.length === 0) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0, modelCalls: 0 };
  }

  return {
    inputTokens: data.reduce((sum: number, r: any) => sum + (r.input_tokens || 0), 0),
    outputTokens: data.reduce((sum: number, r: any) => sum + (r.output_tokens || 0), 0),
    totalTokens: data.reduce((sum: number, r: any) => sum + (r.total_tokens || 0), 0),
    modelCalls: data.reduce((sum: number, r: any) => sum + (r.model_calls || 0), 0),
  };
}
