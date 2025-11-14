import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseService.js';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  context: CategoryContext;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryContext {
  typical_duration?: number | null;
  energy_required?: 'low' | 'medium' | 'high' | null;
  best_time_of_day?: string[];
  prerequisites?: string[];
  related_goals?: string[];
  notes?: string | null;
}

export interface CategoryCreateInput {
  name: string;
  color: string;
  icon?: string;
  description?: string;
  context?: Partial<CategoryContext>;
}

export class CategoryService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get all categories for a user
   */
  async getCategories(userId: string): Promise<Category[]> {
    try {
      let query = this.supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('❌ [CategoryService] Error fetching categories:', error);
        return [];
      }

      return data as Category[];
    } catch (error) {
      console.error('❌ [CategoryService] Exception fetching categories:', error);
      return [];
    }
  }

  /**
   * Get a single category by name
   */
  async getCategoryByName(userId: string, name: string): Promise<Category | null> {
    try {
      const { data, error } = await this.supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .eq('name', name)
        .single();

      if (error) {
        console.error(`❌ [CategoryService] Error fetching category ${name}:`, error);
        return null;
      }

      return data as Category;
    } catch (error) {
      console.error(`❌ [CategoryService] Exception fetching category ${name}:`, error);
      return null;
    }
  }

  /**
   * Get a single category by ID
   */
  async getCategoryById(userId: string, categoryId: string): Promise<Category | null> {
    try {
      const { data, error } = await this.supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .eq('id', categoryId)
        .single();

      if (error) {
        console.error(`❌ [CategoryService] Error fetching category by id ${categoryId}:`, error);
        return null;
      }

      return data as Category;
    } catch (error) {
      console.error(`❌ [CategoryService] Exception fetching category by id ${categoryId}:`, error);
      return null;
    }
  }

  /**
   * Create a new category
   */
  async createCategory(userId: string, input: CategoryCreateInput): Promise<Category | null> {
    try {
      // Validate input
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }
      
      if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
        throw new Error('Category name is required and must be a non-empty string');
      }
      
      if (!input.color || typeof input.color !== 'string' || !input.color.match(/^#[0-9A-Fa-f]{6}$/)) {
        throw new Error('Valid hex color is required (e.g., #3b82f6)');
      }

      const { data, error } = await this.supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: input.name.trim(),
          color: input.color.trim(),
          icon: input.icon?.trim(),
          description: input.description?.trim(),
          context: input.context || {},
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [CategoryService] Error creating category:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from database');
      }

      console.log(`✅ [CategoryService] Created category: ${input.name}`);
      return data as Category;
    } catch (error) {
      console.error('❌ [CategoryService] Exception creating category:', error);
      throw error; // Re-throw to let API handle it
    }
  }

  /**
   * Update a category
   */
  async updateCategory(
    userId: string,
    categoryId: string,
    updates: Partial<CategoryCreateInput>
  ): Promise<Category | null> {
    try {
      // Validate input
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }
      
      if (!categoryId || typeof categoryId !== 'string') {
        throw new Error('Invalid category ID');
      }

      // Validate updates if provided
      if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim().length === 0)) {
        throw new Error('Category name must be a non-empty string');
      }
      
      if (updates.color !== undefined && (typeof updates.color !== 'string' || !updates.color.match(/^#[0-9A-Fa-f]{6}$/))) {
        throw new Error('Valid hex color is required (e.g., #3b82f6)');
      }

      // Prepare update data
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.color !== undefined) updateData.color = updates.color.trim();
      if (updates.icon !== undefined) updateData.icon = updates.icon?.trim();
      if (updates.description !== undefined) updateData.description = updates.description?.trim();
      if (updates.context !== undefined) updateData.context = updates.context;

      const { data, error } = await this.supabase
        .from('categories')
        .update(updateData)
        .eq('id', categoryId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ [CategoryService] Error updating category:', error);
        if (error.code === 'PGRST116') {
          throw new Error('Category not found');
        }
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        throw new Error('Category not found or no data returned');
      }

      console.log(`✅ [CategoryService] Updated category: ${categoryId}`);
      return data as Category;
    } catch (error) {
      console.error('❌ [CategoryService] Exception updating category:', error);
      throw error; // Re-throw to let API handle it
    }
  }

  /**
   * Update category context
   */
  async updateCategoryContext(
    userId: string,
    categoryId: string,
    context: Partial<CategoryContext>
  ): Promise<void> {
    try {
      const category = await this.getCategoryById(userId, categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      const updatedContext = { ...category.context, ...context };

      const { error } = await this.supabase
        .from('categories')
        .update({ context: updatedContext })
        .eq('id', categoryId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log(`✅ [CategoryService] Updated context for category: ${categoryId}`);
    } catch (error) {
      console.error('❌ [CategoryService] Exception updating category context:', error);
      throw error;
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(userId: string, categoryId: string): Promise<void> {
    try {
      // Validate input
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }
      
      if (!categoryId || typeof categoryId !== 'string') {
        throw new Error('Invalid category ID');
      }

      const { error } = await this.supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [CategoryService] Error deleting category:', error);
        if (error.code === 'PGRST116') {
          throw new Error('Category not found');
        }
        throw new Error(`Database error: ${error.message}`);
      }

      console.log(`✅ [CategoryService] Deleted category: ${categoryId}`);
    } catch (error) {
      console.error('❌ [CategoryService] Exception deleting category:', error);
      throw error;
    }
  }

  /**
   * Create default categories for a new user
   */
  async createDefaultCategories(userId: string): Promise<void> {
    try {
      // Check if user already has categories
      const existing = await this.getCategories(userId);
      if (existing.length > 0) {
        console.log(`[CategoryService] User ${userId} already has ${existing.length} categories, skipping defaults`);
        return;
      }

      // Call the database function that creates default categories
      // This ensures we use a single source of truth (the SQL migration)
      const { error } = await this.supabase.rpc('create_default_categories', {
        target_user_id: userId
      });

      if (error) {
        console.error('❌ [CategoryService] Error creating default categories:', error);
        throw error;
      }

      console.log(`✅ [CategoryService] Created default categories for user: ${userId}`);
    } catch (error) {
      console.error('❌ [CategoryService] Exception creating default categories:', error);
      throw error;
    }
  }

  /**
   * Get category color by name
   */
  async getCategoryColor(userId: string, categoryName: string): Promise<string> {
    const category = await this.getCategoryByName(userId, categoryName);
    return category?.color || '#6b7280';  // Default gray
  }
}

export default new CategoryService();
