import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Goal filters for client-side filtering
 */
export interface GoalFilters {
  status?: string;
  aspect?: string;
  goalType?: string;
  parentGoalId?: string;
  targetBefore?: string;
  targetAfter?: string;
}

/**
 * Goal with aspect data
 */
export interface GoalWithAspect {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: string;
  goal_type?: string;
  target_date?: string;
  parent_goal_id?: string;
  progress?: number;
  created_at: string;
  updated_at: string;
  aspect?: string; // For backward compatibility
  aspect_id?: string;
  aspect_name?: string;
  aspect_color?: string;
  aspect_icon?: string;
}

/**
 * Get goals with aspect data using RPC function
 * Includes client-side filtering for various criteria
 */
export async function getGoalsWithAspects(
  client: SupabaseClient,
  userId: string,
  filters?: GoalFilters
): Promise<GoalWithAspect[]> {
  try {
    // Use the RPC function that joins aspect data
    const { data, error } = await client.rpc('get_goals_with_aspects', {
      p_user_id: userId
    });

    if (error) {
      console.error('[GoalHelpers] Error getting goals:', error);
      return [];
    }

    console.log('[GoalHelpers] RPC returned:', {
      dataExists: !!data,
      rawCount: data?.length || 0,
      sampleGoal: data?.[0] ? { id: data[0].id, title: data[0].title, user_id: data[0].user_id } : null
    });

    let filteredGoals = data || [];

    // Apply filters client-side since RPC function doesn't support them yet
    if (filters?.status) {
      filteredGoals = filteredGoals.filter((g: any) => g.status === filters.status);
    }

    if (filters?.aspect) {
      // Strip emoji and do case-insensitive matching
      const normalizedAspect = filters.aspect.replace(/[\p{Emoji}\s]+/gu, '').trim().toLowerCase();
      filteredGoals = filteredGoals.filter((g: any) => {
        const aspectName = (g.aspect_name || g.aspect || '').toLowerCase();
        return aspectName === normalizedAspect || aspectName.includes(normalizedAspect);
      });
    }

    if (filters?.goalType) {
      filteredGoals = filteredGoals.filter((g: any) => g.goal_type === filters.goalType);
    }

    if (filters?.parentGoalId) {
      filteredGoals = filteredGoals.filter((g: any) => g.parent_goal_id === filters.parentGoalId);
    }

    if (filters?.targetBefore) {
      filteredGoals = filteredGoals.filter((g: any) => g.target_date && g.target_date <= filters.targetBefore!);
    }

    if (filters?.targetAfter) {
      filteredGoals = filteredGoals.filter((g: any) => g.target_date && g.target_date >= filters.targetAfter!);
    }

    console.log(`[GoalHelpers] Found ${filteredGoals.length} goals with aspects`);
    return filteredGoals as GoalWithAspect[];
  } catch (error) {
    console.error('[GoalHelpers] Exception getting goals:', error);
    return [];
  }
}

/**
 * Get a single goal by ID with aspect data
 */
export async function getGoalById(
  client: SupabaseClient,
  userId: string,
  goalId: string
): Promise<GoalWithAspect | null> {
  try {
    const goals = await getGoalsWithAspects(client, userId);
    const goal = goals.find(g => g.id === goalId);
    return goal || null;
  } catch (error) {
    console.error('[GoalHelpers] Exception fetching goal by ID:', error);
    return null;
  }
}
