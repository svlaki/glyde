import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Category-related types
 */
export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  context?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  display_order?: number;
}

export interface CategoryCreateInput {
  name: string;
  color: string;
  icon?: string;
  description?: string;
  context?: Record<string, any>;
}

/**
 * Validation helpers
 */

export function validateCategoryInput(input: {
  name?: string;
  color?: string;
}): void {
  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new Error('Category name cannot be empty');
  }

  if (input.color !== undefined && !input.color.match(/^#[0-9A-Fa-f]{6}$/)) {
    throw new Error('Valid hex color required (e.g., #3b82f6)');
  }
}

export function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID');
  }
}

export function validateCategoryId(categoryId: string): void {
  if (!categoryId || typeof categoryId !== 'string') {
    throw new Error('Invalid category ID');
  }
}

/**
 * Category lookup helpers
 */

export async function getCategoryByName(
  client: SupabaseClient,
  userId: string,
  name: string
): Promise<Category | null> {
  try {
    const { data, error } = await client
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .eq('name', name)
      .single();

    if (error) {
      // PGRST116 means no rows returned - that's ok
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`❌ [CategoryHelpers] Error fetching category ${name}:`, error);
      throw error;
    }

    return data as Category;
  } catch (error) {
    console.error(`❌ [CategoryHelpers] Exception fetching category ${name}:`, error);
    throw error;
  }
}

export async function getCategoryById(
  client: SupabaseClient,
  userId: string,
  categoryId: string
): Promise<Category | null> {
  try {
    const { data, error } = await client
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .eq('id', categoryId)
      .single();

    if (error) {
      // PGRST116 means no rows returned - that's ok
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`❌ [CategoryHelpers] Error fetching category by id ${categoryId}:`, error);
      throw error;
    }

    return data as Category;
  } catch (error) {
    console.error(`❌ [CategoryHelpers] Exception fetching category by id ${categoryId}:`, error);
    throw error;
  }
}

/**
 * Resolve category name to ID
 * This is used when tools receive category name instead of category_id
 */
export async function resolveCategoryId(
  client: SupabaseClient,
  userId: string,
  category?: string,
  category_id?: string
): Promise<string | null> {
  // If category_id is provided, use it
  if (category_id) return category_id;

  // If no category name, return null
  if (!category) return null;

  // Look up category by name
  const cat = await getCategoryByName(client, userId, category);
  return cat?.id || null;
}

/**
 * Get category color by name or ID
 */
export async function getCategoryColor(
  client: SupabaseClient,
  userId: string,
  categoryNameOrId: string
): Promise<string> {
  try {
    // Try as ID first
    let category = await getCategoryById(client, userId, categoryNameOrId);

    // If not found, try as name
    if (!category) {
      category = await getCategoryByName(client, userId, categoryNameOrId);
    }

    return category?.color || '#6b7280'; // Default gray
  } catch (error) {
    console.error('❌ [CategoryHelpers] Error getting category color:', error);
    return '#6b7280'; // Default gray
  }
}

/**
 * Create default categories using RPC function
 */
export async function createDefaultCategories(
  client: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    // Check if user already has categories
    const { data: existing } = await client
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[CategoryHelpers] User ${userId} already has categories, skipping defaults`);
      return;
    }

    // Call the database function that creates default categories
    const { error } = await client.rpc('create_default_categories', {
      target_user_id: userId
    });

    if (error) {
      console.error('❌ [CategoryHelpers] Error creating default categories:', error);
      throw error;
    }

    console.log(`✅ [CategoryHelpers] Created default categories for user: ${userId}`);
  } catch (error) {
    console.error('❌ [CategoryHelpers] Exception creating default categories:', error);
    throw error;
  }
}
