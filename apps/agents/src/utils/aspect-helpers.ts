import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Aspect-related types
 */
export interface Aspect {
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

export interface AspectCreateInput {
  name: string;
  color: string;
  icon?: string;
  description?: string;
  context?: Record<string, any>;
}

/**
 * Validation helpers
 */

export function validateAspectInput(input: {
  name?: string;
  color?: string;
}): void {
  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new Error('Aspect name cannot be empty');
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

export function validateAspectId(aspectId: string): void {
  if (!aspectId || typeof aspectId !== 'string') {
    throw new Error('Invalid aspect ID');
  }
}

/**
 * Aspect lookup helpers
 */

export async function getAspectByName(
  client: SupabaseClient,
  userId: string,
  name: string
): Promise<Aspect | null> {
  try {
    const { data, error } = await client
      .from('aspects')
      .select('*')
      .eq('user_id', userId)
      .eq('name', name)
      .single();

    if (error) {
      // PGRST116 means no rows returned - that's ok
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`[AspectHelpers] Error fetching aspect ${name}:`, error);
      throw error;
    }

    return data as Aspect;
  } catch (error) {
    console.error(`[AspectHelpers] Exception fetching aspect ${name}:`, error);
    throw error;
  }
}

export async function getAspectById(
  client: SupabaseClient,
  userId: string,
  aspectId: string
): Promise<Aspect | null> {
  try {
    const { data, error } = await client
      .from('aspects')
      .select('*')
      .eq('user_id', userId)
      .eq('id', aspectId)
      .single();

    if (error) {
      // PGRST116 means no rows returned - that's ok
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`[AspectHelpers] Error fetching aspect by id ${aspectId}:`, error);
      throw error;
    }

    return data as Aspect;
  } catch (error) {
    console.error(`[AspectHelpers] Exception fetching aspect by id ${aspectId}:`, error);
    throw error;
  }
}

/**
 * Resolve aspect name to ID
 * This is used when tools receive aspect name instead of aspect_id
 */
export async function resolveAspectId(
  client: SupabaseClient,
  userId: string,
  aspect?: string,
  aspect_id?: string
): Promise<string | null> {
  // If aspect_id is provided, use it
  if (aspect_id) return aspect_id;

  // If no aspect name, return null
  if (!aspect) return null;

  // Look up aspect by name
  const asp = await getAspectByName(client, userId, aspect);
  return asp?.id || null;
}

/**
 * Get aspect color by name or ID
 */
export async function getAspectColor(
  client: SupabaseClient,
  userId: string,
  aspectNameOrId: string
): Promise<string> {
  try {
    // Try as ID first
    let aspect = await getAspectById(client, userId, aspectNameOrId);

    // If not found, try as name
    if (!aspect) {
      aspect = await getAspectByName(client, userId, aspectNameOrId);
    }

    return aspect?.color || '#6b7280'; // Default gray
  } catch (error) {
    console.error('[AspectHelpers] Error getting aspect color:', error);
    return '#6b7280'; // Default gray
  }
}

/**
 * Create default aspects using RPC function
 */
export async function createDefaultAspects(
  client: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    // Check if user already has aspects
    const { data: existing } = await client
      .from('aspects')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[AspectHelpers] User ${userId} already has aspects, skipping defaults`);
      return;
    }

    // Call the database function that creates default aspects
    const { error } = await client.rpc('create_default_aspects', {
      target_user_id: userId
    });

    if (error) {
      console.error('[AspectHelpers] Error creating default aspects:', error);
      throw error;
    }

    console.log(`[AspectHelpers] Created default aspects for user: ${userId}`);
  } catch (error) {
    console.error('[AspectHelpers] Exception creating default aspects:', error);
    throw error;
  }
}
