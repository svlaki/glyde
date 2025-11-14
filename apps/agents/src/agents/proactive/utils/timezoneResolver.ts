import { AgentContext } from '../../../types/agents.js';
import { SupabaseService } from '../../../services/SupabaseService.js';

/**
 * Resolves the timezone for a user from their profile or context.
 * Falls back to UTC if no timezone is found.
 *
 * @param context - Agent context containing user information
 * @param supabaseService - Supabase service instance for database queries
 * @returns Object containing the resolved timezone
 */
export async function resolveTimezone(
  context: AgentContext,
  supabaseService: SupabaseService
): Promise<{ timezone: string }> {
  // Check if timezone is in user profile (pre-loaded)
  if (context.userProfile?.timezone) {
    return { timezone: context.userProfile.timezone };
  }

  // Check if timezone is directly in context
  if (context.timezone) {
    return { timezone: context.timezone };
  }

  // Fallback: Query database for user profile
  const profile = await supabaseService.getProfile(context.userId);
  return { timezone: profile?.timezone || 'UTC' };
}
