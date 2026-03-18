/**
 * Loads real user data from Supabase for evaluation.
 * Uses a raw Supabase client (not SupabaseService) to avoid mock interference.
 */

import { createClient } from '@supabase/supabase-js';
import type { LoadedUserData, RatingSummaryEntry } from './types.js';

export async function loadUserData(email: string): Promise<LoadedUserData> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const client = createClient(supabaseUrl, supabaseKey);

  // Look up user by email
  const { data: profile, error: profileError } = await client
    .from('profile')
    .select('*')
    .eq('email', email)
    .single();

  if (profileError || !profile) {
    throw new Error(`Profile not found for ${email}: ${profileError?.message}`);
  }

  const userId = profile.id;
  console.log(`[data-loader] Found user: ${profile.display_name || email} (${userId})`);

  // Fetch all context data in parallel
  const [eventsResult, tasksResult, goalsResult, aspectsResult, interactionsResult, ratingsResult, rulesResult] = await Promise.all([
    client.rpc('get_events_with_aspects', { p_user_id: userId }),
    client.rpc('get_tasks_with_aspects', { p_user_id: userId }),
    client.rpc('get_goals_with_aspects', { p_user_id: userId }),
    client
      .from('aspects')
      .select('*')
      .or(`user_id.eq.${userId},visibility.eq.default`)
      .is('archived_at', null),
    client
      .from('user_interactions')
      .select('*, interaction_responses(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    client
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    client
      .from('rules')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true),
  ]);

  // Filter to future/ongoing events
  const now = new Date();
  const allEvents = eventsResult.data || [];
  const events = allEvents.filter(
    (e: any) => new Date(e.end_time) >= now
  );

  // Recent past events (last 7 days) for pattern context
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const recentPastEvents = allEvents.filter(
    (e: any) => new Date(e.end_time) < now && new Date(e.start_time) >= sevenDaysAgo
  );

  // Filter to active tasks
  const tasks = (tasksResult.data || []).filter(
    (t: any) => t.status === 'pending' || t.status === 'in_progress'
  );

  // Filter to active goals
  const goals = (goalsResult.data || []).filter(
    (g: any) => g.status === 'active'
  );

  // Compute rating summary
  const ratingSummary = computeRatingSummary(ratingsResult.data || []);

  console.log(`[data-loader] Loaded: ${events.length} future events, ${recentPastEvents.length} recent past events, ${tasks.length} tasks, ${goals.length} goals, ${(aspectsResult.data || []).length} aspects`);

  return {
    userId,
    profile,
    events,
    tasks,
    goals,
    aspects: aspectsResult.data || [],
    recentInteractions: interactionsResult.data || [],
    ratingSummary,
    rules: rulesResult.data || [],
    recentPastEvents,
  };
}

function computeRatingSummary(ratings: readonly Record<string, any>[]): readonly RatingSummaryEntry[] {
  const topicMap = new Map<string, Record<string, any>[]>();

  for (const r of ratings) {
    const topic = r.topic || 'Unknown';
    const existing = topicMap.get(topic) || [];
    topicMap.set(topic, [...existing, r]);
  }

  return Array.from(topicMap.entries()).map(([topic, entries]) => {
    const sorted = [...entries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latestScore = sorted[0]?.score || 0;
    const previousScore = sorted[1]?.score || latestScore;
    const trend = latestScore - previousScore;

    return {
      topic,
      latestScore,
      trend,
      lastAsked: sorted[0]?.created_at || new Date().toISOString(),
      totalEntries: entries.length,
    };
  });
}
