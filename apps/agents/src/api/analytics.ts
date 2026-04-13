import { Request, Response, Router } from 'express';
import { getSupabaseClient } from '../services/SupabaseService.js';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);

function isAdmin(userId: string | undefined): boolean {
  return !!userId && ADMIN_USER_IDS.includes(userId);
}

const router = Router();

// Admin guard middleware
router.use((req: Request, res: Response, next) => {
  if (!isAdmin(req.authUserId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
});

// POST /api/analytics/overview — DAU/WAU/MAU, total users, total entities
router.post('/overview', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();

    const day1 = new Date(Date.now() - 86400000).toISOString();
    const day7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const day30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [dauEvents, wauEvents, mauEvents, dauActivity, wauActivity, mauActivity, totalUsersRes] = await Promise.all([
      db.from('beta_analytics_events').select('user_id').gte('created_at', day1).not('user_id', 'is', null).limit(5000),
      db.from('beta_analytics_events').select('user_id').gte('created_at', day7).not('user_id', 'is', null).limit(10000),
      db.from('beta_analytics_events').select('user_id').gte('created_at', day30).not('user_id', 'is', null).limit(20000),
      db.from('user_activity_log').select('user_id').gte('created_at', day1).not('user_id', 'is', null).limit(5000),
      db.from('user_activity_log').select('user_id').gte('created_at', day7).not('user_id', 'is', null).limit(10000),
      db.from('user_activity_log').select('user_id').gte('created_at', day30).not('user_id', 'is', null).limit(20000),
      db.from('profile').select('id', { count: 'exact', head: true }),
    ]);

    // Union user IDs from both tables for accurate active user counts
    const unionDistinct = (analyticsRows: { user_id: string }[], activityRows: { user_id: string }[]) => {
      const ids = new Set<string>();
      for (const r of analyticsRows) if (r.user_id) ids.add(r.user_id);
      for (const r of activityRows) if (r.user_id) ids.add(r.user_id);
      return ids.size;
    };

    const dau = unionDistinct((dauEvents.data as any[]) || [], (dauActivity.data as any[]) || []);
    const wau = unionDistinct((wauEvents.data as any[]) || [], (wauActivity.data as any[]) || []);
    const mau = unionDistinct((mauEvents.data as any[]) || [], (mauActivity.data as any[]) || []);

    res.json({
      success: true,
      data: {
        dau,
        wau,
        mau,
        total_users: totalUsersRes.count ?? 0,
      },
    });
  } catch (error) {
    console.error('[ANALYTICS] Overview error:', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// POST /api/analytics/engagement — session stats, page views, feature usage
router.post('/engagement', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    const day30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [pageViewsRes, sessionsRes, featureEventsRes, activityRes] = await Promise.all([
      db.from('beta_analytics_events')
        .select('page_path, created_at')
        .eq('event_name', 'page_view')
        .gte('created_at', day30)
        .order('created_at', { ascending: false })
        .limit(5000),
      db.from('beta_analytics_events')
        .select('session_id, user_id, created_at')
        .eq('event_name', 'session_start')
        .gte('created_at', day30)
        .order('created_at', { ascending: false })
        .limit(2000),
      db.from('beta_analytics_events')
        .select('event_name, created_at')
        .eq('event_category', 'engagement')
        .gte('created_at', day30)
        .neq('event_name', 'page_view')
        .neq('event_name', 'session_start')
        .limit(5000),
      db.from('user_activity_log')
        .select('entity_type, operation, created_at')
        .gte('created_at', day30)
        .limit(10000),
    ]);

    // Count page views by path
    const pageViewCounts: Record<string, number> = {};
    for (const row of pageViewsRes.data || []) {
      pageViewCounts[row.page_path] = (pageViewCounts[row.page_path] || 0) + 1;
    }

    // Bug 3 fix: Count distinct session IDs instead of rows
    const distinctSessionIds = new Set<string>();
    for (const row of sessionsRes.data || []) {
      if (row.session_id) distinctSessionIds.add(row.session_id);
    }

    // Count feature events by name
    const featureCounts: Record<string, number> = {};
    for (const row of featureEventsRes.data || []) {
      featureCounts[row.event_name] = (featureCounts[row.event_name] || 0) + 1;
    }

    // Bug 4 fix: Merge CRUD operations from activity log into feature counts
    for (const row of activityRes.data || []) {
      const key = `${row.entity_type}_${row.operation}`;
      featureCounts[key] = (featureCounts[key] || 0) + 1;
    }

    res.json({
      success: true,
      data: {
        total_page_views: pageViewsRes.data?.length ?? 0,
        total_sessions: distinctSessionIds.size,
        page_view_counts: pageViewCounts,
        feature_counts: featureCounts,
      },
    });
  } catch (error) {
    console.error('[ANALYTICS] Engagement error:', error);
    res.status(500).json({ error: 'Failed to fetch engagement data' });
  }
});

// POST /api/analytics/agents — interaction acceptance/dismissal rates, chat usage
router.post('/agents', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    const day30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [respondedRes, dismissedRes, chatRes] = await Promise.all([
      db.from('beta_analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'interaction_responded')
        .gte('created_at', day30),
      db.from('beta_analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'interaction_dismissed')
        .gte('created_at', day30),
      db.from('beta_analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'chat_message_sent')
        .gte('created_at', day30),
    ]);

    const responded = respondedRes.count ?? 0;
    const dismissed = dismissedRes.count ?? 0;
    const total = responded + dismissed;

    res.json({
      success: true,
      data: {
        interactions_responded: responded,
        interactions_dismissed: dismissed,
        interaction_total: total,
        acceptance_rate: total > 0 ? Math.round((responded / total) * 100) : 0,
        chat_messages_sent: chatRes.count ?? 0,
      },
    });
  } catch (error) {
    console.error('[ANALYTICS] Agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agent analytics' });
  }
});

// POST /api/analytics/users — per-user engagement summary table
router.post('/users', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();

    // Get all profiles
    const { data: profiles } = await db.from('profile').select('id, display_name, email, created_at').limit(500);

    // Get recent event counts per user (with session_id for distinct counting)
    const day30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const [eventsRes, activityRes] = await Promise.all([
      db.from('beta_analytics_events')
        .select('user_id, event_name, session_id, created_at')
        .gte('created_at', day30)
        .limit(10000),
      db.from('user_activity_log')
        .select('user_id, entity_type, operation, created_at')
        .gte('created_at', day30)
        .limit(10000),
    ]);

    // Aggregate per user from analytics events
    const userStats: Record<string, { events: number; last_active: string; sessionIds: Set<string>; pages: number }> = {};
    for (const event of eventsRes.data || []) {
      if (!event.user_id) continue;
      if (!userStats[event.user_id]) {
        userStats[event.user_id] = { events: 0, last_active: event.created_at, sessionIds: new Set(), pages: 0 };
      }
      const u = userStats[event.user_id];
      u.events++;
      if (event.created_at > u.last_active) u.last_active = event.created_at;
      // Bug 3 fix: count distinct session IDs
      if (event.event_name === 'session_start' && event.session_id) u.sessionIds.add(event.session_id);
      if (event.event_name === 'page_view') u.pages++;
    }

    // Bug 4 fix: Merge activity log data
    for (const row of activityRes.data || []) {
      if (!row.user_id) continue;
      if (!userStats[row.user_id]) {
        userStats[row.user_id] = { events: 0, last_active: row.created_at, sessionIds: new Set(), pages: 0 };
      }
      const u = userStats[row.user_id];
      u.events++;
      if (row.created_at > u.last_active) u.last_active = row.created_at;
    }

    const users = (profiles || []).map((p: any) => ({
      id: p.id,
      display_name: p.display_name,
      email: p.email,
      signed_up: p.created_at,
      last_active: userStats[p.id]?.last_active ?? null,
      total_events: userStats[p.id]?.events ?? 0,
      sessions_30d: userStats[p.id]?.sessionIds.size ?? 0,
      page_views_30d: userStats[p.id]?.pages ?? 0,
    }));

    res.json({ success: true, data: { users } });
  } catch (error) {
    console.error('[ANALYTICS] Users error:', error);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

// POST /api/analytics/retention — cohort retention (D1/D7/D14/D30)
router.post('/retention', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();

    // Get signup dates from profiles
    const { data: profiles } = await db.from('profile').select('id, created_at').limit(500);

    // Get session_start AND page_view events (not just session_start)
    // Bound to 60 days to cover D30 for users who signed up 30 days ago
    const day60 = new Date(Date.now() - 60 * 86400000).toISOString();
    const [sessionsRes, activityRes] = await Promise.all([
      db.from('beta_analytics_events')
        .select('user_id, created_at')
        .in('event_name', ['session_start', 'page_view'])
        .gte('created_at', day60)
        .not('user_id', 'is', null)
        .limit(20000),
      db.from('user_activity_log')
        .select('user_id, created_at')
        .gte('created_at', day60)
        .not('user_id', 'is', null)
        .limit(20000),
    ]);

    // Build activity dates per user from both tables
    const userActivityDates: Record<string, Set<string>> = {};

    const addDate = (userId: string, dateStr: string) => {
      if (!userId) return;
      if (!userActivityDates[userId]) userActivityDates[userId] = new Set();
      userActivityDates[userId].add(new Date(dateStr).toISOString().slice(0, 10));
    };

    for (const s of sessionsRes.data || []) {
      if (s.user_id) addDate(s.user_id, s.created_at);
    }
    for (const a of activityRes.data || []) {
      if (a.user_id) addDate(a.user_id, a.created_at);
    }

    // Window-based retention: user returned within the window after signup
    // D1 = returned on day 1 after signup
    // D7 = returned within days 1-7
    // D14 = returned within days 1-14
    // D30 = returned within days 1-30
    const retentionWindows: { label: string; startDay: number; endDay: number }[] = [
      { label: 'D1', startDay: 1, endDay: 1 },
      { label: 'D7', startDay: 1, endDay: 7 },
      { label: 'D14', startDay: 1, endDay: 14 },
      { label: 'D30', startDay: 1, endDay: 30 },
    ];

    const retention: Record<string, { total: number; retained: number; rate: number }> = {};

    for (const w of retentionWindows) {
      let total = 0;
      let retained = 0;

      for (const p of profiles || []) {
        const signupDate = new Date(p.created_at);
        const windowEnd = new Date(signupDate.getTime() + w.endDay * 86400000);

        // Only count users who signed up at least endDay days ago
        if (windowEnd.getTime() > Date.now()) continue;
        total++;

        const dates = userActivityDates[p.id];
        if (dates) {
          const signupDay = signupDate.getTime();
          const windowStartMs = signupDay + w.startDay * 86400000;
          const windowEndMs = signupDay + (w.endDay + 1) * 86400000; // inclusive end day

          for (const dateStr of dates) {
            const dateMs = new Date(dateStr).getTime();
            if (dateMs >= windowStartMs && dateMs < windowEndMs) {
              retained++;
              break;
            }
          }
        }
      }

      retention[w.label] = {
        total,
        retained,
        rate: total > 0 ? Math.round((retained / total) * 100) : 0,
      };
    }

    res.json({ success: true, data: { retention } });
  } catch (error) {
    console.error('[ANALYTICS] Retention error:', error);
    res.status(500).json({ error: 'Failed to fetch retention data' });
  }
});

// POST /api/analytics/overview-timeseries — daily DAU for last 30 days
router.post('/overview-timeseries', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    const day30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [eventsRes, activityRes] = await Promise.all([
      db.from('beta_analytics_events')
        .select('user_id, created_at')
        .gte('created_at', day30)
        .not('user_id', 'is', null)
        .limit(20000),
      db.from('user_activity_log')
        .select('user_id, created_at')
        .gte('created_at', day30)
        .not('user_id', 'is', null)
        .limit(20000),
    ]);

    // Group unique users by date
    const dailyUsers: Record<string, Set<string>> = {};
    for (const row of [...(eventsRes.data || []), ...(activityRes.data || [])]) {
      if (!row.user_id) continue;
      const date = new Date(row.created_at).toISOString().slice(0, 10);
      if (!dailyUsers[date]) dailyUsers[date] = new Set();
      dailyUsers[date].add(row.user_id);
    }

    // Build sorted array for last 30 days
    const timeseries: { date: string; dau: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      timeseries.push({ date, dau: dailyUsers[date]?.size ?? 0 });
    }

    res.json({ success: true, data: { timeseries } });
  } catch (error) {
    console.error('[ANALYTICS] Overview timeseries error:', error);
    res.status(500).json({ error: 'Failed to fetch overview timeseries' });
  }
});

// POST /api/analytics/agents-timeseries — daily agent interactions for last 30 days
router.post('/agents-timeseries', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    const day30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: events } = await db.from('beta_analytics_events')
      .select('event_name, created_at')
      .in('event_name', ['interaction_responded', 'interaction_dismissed', 'chat_message_sent'])
      .gte('created_at', day30)
      .limit(10000);

    // Group by date and event type
    const dailyCounts: Record<string, { responded: number; dismissed: number; chat_messages: number }> = {};
    for (const row of events || []) {
      const date = new Date(row.created_at).toISOString().slice(0, 10);
      if (!dailyCounts[date]) dailyCounts[date] = { responded: 0, dismissed: 0, chat_messages: 0 };
      if (row.event_name === 'interaction_responded') dailyCounts[date].responded++;
      else if (row.event_name === 'interaction_dismissed') dailyCounts[date].dismissed++;
      else if (row.event_name === 'chat_message_sent') dailyCounts[date].chat_messages++;
    }

    const timeseries: { date: string; responded: number; dismissed: number; chat_messages: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      timeseries.push({
        date,
        responded: dailyCounts[date]?.responded ?? 0,
        dismissed: dailyCounts[date]?.dismissed ?? 0,
        chat_messages: dailyCounts[date]?.chat_messages ?? 0,
      });
    }

    res.json({ success: true, data: { timeseries } });
  } catch (error) {
    console.error('[ANALYTICS] Agents timeseries error:', error);
    res.status(500).json({ error: 'Failed to fetch agents timeseries' });
  }
});

// POST /api/analytics/engagement-timeseries — daily page views & sessions for last 30 days
router.post('/engagement-timeseries', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    const day30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: events } = await db.from('beta_analytics_events')
      .select('event_name, session_id, created_at')
      .in('event_name', ['page_view', 'session_start'])
      .gte('created_at', day30)
      .limit(10000);

    const dailyCounts: Record<string, { page_views: number; sessionIds: Set<string> }> = {};
    for (const row of events || []) {
      const date = new Date(row.created_at).toISOString().slice(0, 10);
      if (!dailyCounts[date]) dailyCounts[date] = { page_views: 0, sessionIds: new Set() };
      if (row.event_name === 'page_view') dailyCounts[date].page_views++;
      if (row.event_name === 'session_start' && row.session_id) dailyCounts[date].sessionIds.add(row.session_id);
    }

    const timeseries: { date: string; page_views: number; sessions: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      timeseries.push({
        date,
        page_views: dailyCounts[date]?.page_views ?? 0,
        sessions: dailyCounts[date]?.sessionIds.size ?? 0,
      });
    }

    res.json({ success: true, data: { timeseries } });
  } catch (error) {
    console.error('[ANALYTICS] Engagement timeseries error:', error);
    res.status(500).json({ error: 'Failed to fetch engagement timeseries' });
  }
});

// POST /api/analytics/context — token usage metrics for Context tab
router.post('/context', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    const day30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: tokenRows } = await db.from('agent_token_usage')
      .select('user_id, input_tokens, output_tokens, total_tokens, processing_time_ms, created_at')
      .gte('created_at', day30)
      .order('created_at', { ascending: false })
      .limit(10000);

    const rows = tokenRows || [];

    // Totals
    let totalInput = 0;
    let totalOutput = 0;
    let totalTokens = 0;
    let totalProcessingMs = 0;
    let processingCount = 0;

    for (const row of rows) {
      totalInput += row.input_tokens || 0;
      totalOutput += row.output_tokens || 0;
      totalTokens += row.total_tokens || 0;
      if (row.processing_time_ms) {
        totalProcessingMs += row.processing_time_ms;
        processingCount++;
      }
    }

    const totalInteractions = rows.length;
    const avgTokensPerInteraction = totalInteractions > 0 ? Math.round(totalTokens / totalInteractions) : 0;
    const avgProcessingTimeMs = processingCount > 0 ? Math.round(totalProcessingMs / processingCount) : 0;

    // Estimated cost: GPT-5.1 pricing approximation ($2.50/1M input, $10/1M output)
    const estCost = (totalInput / 1_000_000) * 2.5 + (totalOutput / 1_000_000) * 10;

    // Daily token usage
    const dailyTokens: Record<string, { input: number; output: number }> = {};
    for (const row of rows) {
      const date = new Date(row.created_at).toISOString().slice(0, 10);
      if (!dailyTokens[date]) dailyTokens[date] = { input: 0, output: 0 };
      dailyTokens[date].input += row.input_tokens || 0;
      dailyTokens[date].output += row.output_tokens || 0;
    }

    const daily_usage: { date: string; input_tokens: number; output_tokens: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      daily_usage.push({
        date,
        input_tokens: dailyTokens[date]?.input ?? 0,
        output_tokens: dailyTokens[date]?.output ?? 0,
      });
    }

    // Top 10 users by token consumption
    const userTokens: Record<string, number> = {};
    for (const row of rows) {
      if (!row.user_id) continue;
      userTokens[row.user_id] = (userTokens[row.user_id] || 0) + (row.total_tokens || 0);
    }

    // Resolve display names for top users
    const sortedUserIds = Object.entries(userTokens)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id);

    let topUsers: { user_id: string; display_name: string; total_tokens: number }[] = [];
    if (sortedUserIds.length > 0) {
      const { data: profiles } = await db.from('profile')
        .select('id, display_name')
        .in('id', sortedUserIds);

      const nameMap: Record<string, string> = {};
      for (const p of profiles || []) {
        nameMap[p.id] = p.display_name || p.id.slice(0, 8);
      }

      topUsers = sortedUserIds.map(id => ({
        user_id: id,
        display_name: nameMap[id] || id.slice(0, 8),
        total_tokens: userTokens[id],
      }));
    }

    res.json({
      success: true,
      data: {
        totals: {
          input_tokens: totalInput,
          output_tokens: totalOutput,
          total_tokens: totalTokens,
          total_interactions: totalInteractions,
          avg_tokens_per_interaction: avgTokensPerInteraction,
          avg_processing_time_ms: avgProcessingTimeMs,
          est_cost: Math.round(estCost * 100) / 100,
        },
        daily_usage,
        top_users: topUsers,
      },
    });
  } catch (error) {
    console.error('[ANALYTICS] Context error:', error);
    res.status(500).json({ error: 'Failed to fetch context analytics' });
  }
});

// POST /api/analytics/context-reset — clear all agent token usage tracking
router.post('/context-reset', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    const { error } = await db.from('agent_token_usage').delete().not('id', 'is', null);
    if (error) throw error;
    res.json({ success: true, data: { reset: true } });
  } catch (error) {
    console.error('[ANALYTICS] Context reset error:', error);
    res.status(500).json({ error: 'Failed to reset token usage' });
  }
});

export default router;
