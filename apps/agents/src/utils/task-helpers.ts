import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Task filters for client-side filtering
 */
export interface TaskFilters {
  status?: string;
  category?: string;
  priority?: string;
  parentGoalId?: string;
  dueBefore?: string;
  dueAfter?: string;
}

/**
 * Task with category data
 */
export interface TaskWithCategory {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  due_date?: string;
  completed_at?: string;
  parent_goal_id?: string;
  created_at: string;
  updated_at: string;
  category?: string; // For backward compatibility
  category_id?: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
}

/**
 * Get tasks with category data using RPC function
 * Includes client-side filtering for various criteria
 */
export async function getTasksWithCategories(
  client: SupabaseClient,
  userId: string,
  filters?: TaskFilters
): Promise<TaskWithCategory[]> {
  try {
    console.log('🔍 [TaskHelpers] Getting tasks for user:', userId);

    // Use the RPC function that joins category data
    const { data, error } = await client.rpc('get_tasks_with_categories', {
      p_user_id: userId
    });

    if (error) {
      console.error('❌ [TaskHelpers] Error getting tasks:', error);
      return [];
    }

    console.log('🔍 [TaskHelpers] Raw RPC data:', {
      type: typeof data,
      isArray: Array.isArray(data),
      count: data?.length || 0,
      sample: data && data.length > 0 ? data[0] : null
    });

    let filteredTasks = data || [];

    // Apply filters client-side since RPC function doesn't support them yet
    if (filters?.status) {
      filteredTasks = filteredTasks.filter((t: any) => t.status === filters.status);
    }

    if (filters?.category) {
      // Strip emoji and do case-insensitive matching
      const normalizedCategory = filters.category.replace(/[\p{Emoji}\s]+/gu, '').trim().toLowerCase();
      filteredTasks = filteredTasks.filter((t: any) => {
        const categoryName = (t.category_name || t.category || '').toLowerCase();
        return categoryName === normalizedCategory || categoryName.includes(normalizedCategory);
      });
    }

    if (filters?.priority) {
      filteredTasks = filteredTasks.filter((t: any) => t.priority === filters.priority);
    }

    if (filters?.parentGoalId) {
      filteredTasks = filteredTasks.filter((t: any) => t.parent_goal_id === filters.parentGoalId);
    }

    if (filters?.dueBefore) {
      filteredTasks = filteredTasks.filter((t: any) => t.due_date && t.due_date <= filters.dueBefore!);
    }

    if (filters?.dueAfter) {
      filteredTasks = filteredTasks.filter((t: any) => t.due_date && t.due_date >= filters.dueAfter!);
    }

    console.log(`✅ [TaskHelpers] Found ${filteredTasks.length} tasks with categories`);
    return filteredTasks as TaskWithCategory[];
  } catch (error) {
    console.error('❌ [TaskHelpers] Exception getting tasks:', error);
    return [];
  }
}

/**
 * Get a single task by ID with category data
 */
export async function getTaskById(
  client: SupabaseClient,
  userId: string,
  taskId: string
): Promise<TaskWithCategory | null> {
  try {
    const tasks = await getTasksWithCategories(client, userId);
    const task = tasks.find(t => t.id === taskId);
    return task || null;
  } catch (error) {
    console.error('❌ [TaskHelpers] Exception fetching task by ID:', error);
    return null;
  }
}
