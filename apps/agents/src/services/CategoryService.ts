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
  applies_to: ('events' | 'tasks' | 'goals')[];
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
  applies_to?: ('events' | 'tasks' | 'goals')[];
}

export class CategoryService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get all categories for a user
   */
  async getCategories(userId: string, type?: 'events' | 'tasks' | 'goals'): Promise<Category[]> {
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

      // Filter by type if specified
      if (type && data) {
        return data.filter((cat: Category) => cat.applies_to.includes(type));
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
   * Create a new category
   */
  async createCategory(userId: string, input: CategoryCreateInput): Promise<Category | null> {
    try {
      const { data, error } = await this.supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: input.name,
          color: input.color,
          icon: input.icon,
          description: input.description,
          context: input.context || {},
          applies_to: input.applies_to || ['events', 'tasks', 'goals'],
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [CategoryService] Error creating category:', error);
        return null;
      }

      console.log(`✅ [CategoryService] Created category: ${input.name}`);
      return data as Category;
    } catch (error) {
      console.error('❌ [CategoryService] Exception creating category:', error);
      return null;
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
      const { data, error } = await this.supabase
        .from('categories')
        .update(updates)
        .eq('id', categoryId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ [CategoryService] Error updating category:', error);
        return null;
      }

      console.log(`✅ [CategoryService] Updated category: ${categoryId}`);
      return data as Category;
    } catch (error) {
      console.error('❌ [CategoryService] Exception updating category:', error);
      return null;
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
      const category = await this.getCategoryByName(userId, categoryId);
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
      const { error } = await this.supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', userId);

      if (error) {
        throw error;
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
        console.log(`⚠️ [CategoryService] User ${userId} already has ${existing.length} categories, skipping defaults`);
        return;
      }

      // Default categories everyone should have
      const defaultCategories = [
        // Work & Career
        { name: 'Work', color: '#3b82f6', icon: '💼', description: 'Work-related tasks and meetings', order: 1 },
        { name: 'Meetings', color: '#8b5cf6', icon: '🤝', description: 'Scheduled meetings and calls', order: 2 },

        // Personal Development
        { name: 'Personal', color: '#10b981', icon: '🏡', description: 'Personal activities and errands', order: 3 },
        { name: 'Learning', color: '#f59e0b', icon: '📚', description: 'Education, courses, and skill development', order: 4 },

        // Health & Wellness
        { name: 'Exercise', color: '#ef4444', icon: '🏋️', description: 'Workouts and physical activity', order: 5 },
        { name: 'Health', color: '#ec4899', icon: '🏥', description: 'Medical appointments and health-related activities', order: 6 },

        // Social & Relationships
        { name: 'Social', color: '#06b6d4', icon: '👥', description: 'Social events and hanging out with friends', order: 7 },
        { name: 'Family', color: '#f43f5e', icon: '❤️', description: 'Family time and activities', order: 8 },

        // Daily Life
        { name: 'Errands', color: '#84cc16', icon: '🛒', description: 'Shopping and errands', order: 9 },
        { name: 'Chores', color: '#a855f7', icon: '🧹', description: 'Household chores and maintenance', order: 10 },

        // Entertainment & Hobbies
        { name: 'Hobbies', color: '#14b8a6', icon: '🎨', description: 'Personal hobbies and creative pursuits', order: 11 },
        { name: 'Entertainment', color: '#eab308', icon: '🎬', description: 'Movies, shows, games, and fun activities', order: 12 },
      ];

      // Insert all default categories
      const { error } = await this.supabase
        .from('categories')
        .insert(
          defaultCategories.map(cat => ({
            user_id: userId,
            name: cat.name,
            color: cat.color,
            icon: cat.icon,
            description: cat.description,
            display_order: cat.order,
            context: {},
          }))
        );

      if (error) {
        console.error('❌ [CategoryService] Error creating default categories:', error);
        throw error;
      }

      console.log(`✅ [CategoryService] Created ${defaultCategories.length} default categories for user: ${userId}`);
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
