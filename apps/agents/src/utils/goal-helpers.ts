import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Goal filters for client-side filtering
 */
export interface GoalFilters {
  status?: string;
  category?: string;
  goalType?: string;
  parentGoalId?: string;
  targetBefore?: string;
  targetAfter?: string;
}

/**
 * Goal with category data
 */
export interface GoalWithCategory {
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
  category?: string; // For backward compatibility
  category_id?: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
}

/**
 * Get goals with category data using RPC function
 * Includes client-side filtering for various criteria
 */
export async function getGoalsWithCategories(
  client: SupabaseClient,
  userId: string,
  filters?: GoalFilters
): Promise<GoalWithCategory[]> {
  try {
    // Use the RPC function that joins category data
    const { data, error } = await client.rpc('get_goals_with_categories', {
      p_user_id: userId
    });

    if (error) {
      console.error('❌ [GoalHelpers] Error getting goals:', error);
      return [];
    }

    console.log('📥 [GoalHelpers] RPC returned:', {
      dataExists: !!data,
      rawCount: data?.length || 0,
      sampleGoal: data?.[0] ? { id: data[0].id, title: data[0].title, user_id: data[0].user_id } : null
    });

    let filteredGoals = data || [];

    // Apply filters client-side since RPC function doesn't support them yet
    if (filters?.status) {
      filteredGoals = filteredGoals.filter((g: any) => g.status === filters.status);
    }

    if (filters?.category) {
      // Strip emoji and do case-insensitive matching
      const normalizedCategory = filters.category.replace(/[\p{Emoji}\s]+/gu, '').trim().toLowerCase();
      filteredGoals = filteredGoals.filter((g: any) => {
        const categoryName = (g.category_name || g.category || '').toLowerCase();
        return categoryName === normalizedCategory || categoryName.includes(normalizedCategory);
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

    console.log(`✅ [GoalHelpers] Found ${filteredGoals.length} goals with categories`);
    return filteredGoals as GoalWithCategory[];
  } catch (error) {
    console.error('❌ [GoalHelpers] Exception getting goals:', error);
    return [];
  }
}

/**
 * Get a single goal by ID with category data
 */
export async function getGoalById(
  client: SupabaseClient,
  userId: string,
  goalId: string
): Promise<GoalWithCategory | null> {
  try {
    const goals = await getGoalsWithCategories(client, userId);
    const goal = goals.find(g => g.id === goalId);
    return goal || null;
  } catch (error) {
    console.error('❌ [GoalHelpers] Exception fetching goal by ID:', error);
    return null;
  }
}
