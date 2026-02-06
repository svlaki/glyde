import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseService.js';

export interface Aspect {
  id: string;
  user_id: string;
  name: string;
  color: string;
  description?: string;
  context: AspectContext;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface AspectContext {
  typical_duration?: number | null;
  energy_required?: 'low' | 'medium' | 'high' | null;
  best_time_of_day?: string[];
  prerequisites?: string[];
  related_goals?: string[];
  notes?: string | null;
}

export interface AspectCreateInput {
  name: string;
  color: string;
  description?: string;
  context?: Partial<AspectContext>;
}

export class AspectService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get all aspects for a user
   */
  async getAspects(userId: string): Promise<Aspect[]> {
    try {
      let query = this.supabase
        .from('aspects')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('[AspectService] Error fetching aspects:', error);
        return [];
      }

      return data as Aspect[];
    } catch (error) {
      console.error('[AspectService] Exception fetching aspects:', error);
      return [];
    }
  }

  /**
   * Get a single aspect by name
   */
  async getAspectByName(userId: string, name: string): Promise<Aspect | null> {
    try {
      const { data, error } = await this.supabase
        .from('aspects')
        .select('*')
        .eq('user_id', userId)
        .eq('name', name)
        .single();

      if (error) {
        console.error(`[AspectService] Error fetching aspect ${name}:`, error);
        return null;
      }

      return data as Aspect;
    } catch (error) {
      console.error(`[AspectService] Exception fetching aspect ${name}:`, error);
      return null;
    }
  }

  /**
   * Get a single aspect by ID
   */
  async getAspectById(userId: string, aspectId: string): Promise<Aspect | null> {
    try {
      const { data, error } = await this.supabase
        .from('aspects')
        .select('*')
        .eq('user_id', userId)
        .eq('id', aspectId)
        .single();

      if (error) {
        console.error(`[AspectService] Error fetching aspect by id ${aspectId}:`, error);
        return null;
      }

      return data as Aspect;
    } catch (error) {
      console.error(`[AspectService] Exception fetching aspect by id ${aspectId}:`, error);
      return null;
    }
  }

  /**
   * Create a new aspect
   */
  async createAspect(userId: string, input: AspectCreateInput): Promise<Aspect | null> {
    try {
      // Validate input
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }

      if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
        throw new Error('Aspect name is required and must be a non-empty string');
      }

      if (!input.color || typeof input.color !== 'string' || !input.color.match(/^#[0-9A-Fa-f]{6}$/)) {
        throw new Error('Valid hex color is required (e.g., #3b82f6)');
      }

      const { data, error } = await this.supabase
        .from('aspects')
        .insert({
          user_id: userId,
          name: input.name.trim(),
          color: input.color.trim(),
          description: input.description?.trim(),
          context: input.context || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[AspectService] Error creating aspect:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from database');
      }

      console.log(`[AspectService] Created aspect: ${input.name}`);
      return data as Aspect;
    } catch (error) {
      console.error('[AspectService] Exception creating aspect:', error);
      throw error;
    }
  }

  /**
   * Create or update an aspect (upsert) - handles duplicates gracefully
   */
  async upsertAspect(userId: string, input: AspectCreateInput): Promise<Aspect | null> {
    try {
      // Validate input
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }

      if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
        throw new Error('Aspect name is required and must be a non-empty string');
      }

      if (!input.color || typeof input.color !== 'string' || !input.color.match(/^#[0-9A-Fa-f]{6}$/)) {
        throw new Error('Valid hex color is required (e.g., #3b82f6)');
      }

      const { data, error } = await this.supabase
        .from('aspects')
        .upsert({
          user_id: userId,
          name: input.name.trim(),
          color: input.color.trim(),
          description: input.description?.trim(),
          context: input.context || {},
        }, {
          onConflict: 'user_id,name',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error('[AspectService] Error upserting aspect:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from database');
      }

      console.log(`[AspectService] Upserted aspect: ${input.name}`);
      return data as Aspect;
    } catch (error) {
      console.error('[AspectService] Exception upserting aspect:', error);
      throw error;
    }
  }

  /**
   * Update an aspect
   */
  async updateAspect(
    userId: string,
    aspectId: string,
    updates: Partial<AspectCreateInput>
  ): Promise<Aspect | null> {
    try {
      // Validate input
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }

      if (!aspectId || typeof aspectId !== 'string') {
        throw new Error('Invalid aspect ID');
      }

      // Validate updates if provided
      if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim().length === 0)) {
        throw new Error('Aspect name must be a non-empty string');
      }

      if (updates.color !== undefined && (typeof updates.color !== 'string' || !updates.color.match(/^#[0-9A-Fa-f]{6}$/))) {
        throw new Error('Valid hex color is required (e.g., #3b82f6)');
      }

      // Prepare update data
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.color !== undefined) updateData.color = updates.color.trim();
      if (updates.description !== undefined) updateData.description = updates.description?.trim();
      if (updates.context !== undefined) updateData.context = updates.context;

      const { data, error } = await this.supabase
        .from('aspects')
        .update(updateData)
        .eq('id', aspectId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('[AspectService] Error updating aspect:', error);
        if (error.code === 'PGRST116') {
          throw new Error('Aspect not found');
        }
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        throw new Error('Aspect not found or no data returned');
      }

      console.log(`[AspectService] Updated aspect: ${aspectId}`);
      return data as Aspect;
    } catch (error) {
      console.error('[AspectService] Exception updating aspect:', error);
      throw error;
    }
  }

  /**
   * Update aspect context
   */
  async updateAspectContext(
    userId: string,
    aspectId: string,
    context: Partial<AspectContext>
  ): Promise<void> {
    try {
      const aspect = await this.getAspectById(userId, aspectId);
      if (!aspect) {
        throw new Error('Aspect not found');
      }

      const updatedContext = { ...aspect.context, ...context };

      const { error } = await this.supabase
        .from('aspects')
        .update({ context: updatedContext })
        .eq('id', aspectId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log(`[AspectService] Updated context for aspect: ${aspectId}`);
    } catch (error) {
      console.error('[AspectService] Exception updating aspect context:', error);
      throw error;
    }
  }

  /**
   * Delete an aspect
   */
  async deleteAspect(userId: string, aspectId: string): Promise<void> {
    try {
      // Validate input
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }

      if (!aspectId || typeof aspectId !== 'string') {
        throw new Error('Invalid aspect ID');
      }

      const { error } = await this.supabase
        .from('aspects')
        .delete()
        .eq('id', aspectId)
        .eq('user_id', userId);

      if (error) {
        console.error('[AspectService] Error deleting aspect:', error);
        if (error.code === 'PGRST116') {
          throw new Error('Aspect not found');
        }
        throw new Error(`Database error: ${error.message}`);
      }

      console.log(`[AspectService] Deleted aspect: ${aspectId}`);
    } catch (error) {
      console.error('[AspectService] Exception deleting aspect:', error);
      throw error;
    }
  }

  /**
   * Get aspect color by name
   */
  async getAspectColor(userId: string, aspectName: string): Promise<string> {
    const aspect = await this.getAspectByName(userId, aspectName);
    return aspect?.color || '#6b7280';  // Default gray
  }
}

export default new AspectService();
