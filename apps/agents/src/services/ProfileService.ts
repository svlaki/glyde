import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseService.js';

// Schema-aligned profile structure
export interface UserProfile {
  id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  values?: Record<string, any>;
  preferences?: Record<string, any>;
  work_patterns?: Record<string, any>;
  goals_summary?: string;
  personality_traits?: Record<string, any>;
  context_data?: Record<string, any>;
  timezone?: string;
  created_at?: string;
}

export class ProfileService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get the complete user profile
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('profile')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ [ProfileService] Error fetching profile:', error);
        return null;
      }

      // If no profile exists, create one
      if (!data) {
        const { data: newProfile, error: createError } = await this.supabase
          .from('profile')
          .insert({
            id: userId,
            values: {},
            preferences: {},
            work_patterns: {},
            personality_traits: {},
            context_data: {}
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ [ProfileService] Error creating profile:', createError);
          return null;
        }

        return newProfile as UserProfile;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('❌ [ProfileService] Exception fetching profile:', error);
      return null;
    }
  }

  /**
   * Update the entire user profile
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('profile')
        .update(updates)
        .eq('id', userId);

      if (error) {
        console.error('❌ [ProfileService] Error updating profile:', error);
        throw error;
      }

      console.log('✅ [ProfileService] Profile updated successfully');
    } catch (error) {
      console.error('❌ [ProfileService] Exception updating profile:', error);
      throw error;
    }
  }

  /**
   * Update a specific section of the profile (values, preferences, work_patterns, etc.)
   */
  async updateProfileSection(
    userId: string,
    section: keyof Pick<UserProfile, 'values' | 'preferences' | 'work_patterns' | 'personality_traits' | 'context_data'>,
    data: Record<string, any>
  ): Promise<void> {
    try {
      const updates = { [section]: data };
      await this.updateProfile(userId, updates);
    } catch (error) {
      console.error(`❌ [ProfileService] Error updating section ${section}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific section of the profile
   */
  async getProfileSection(
    userId: string,
    section: keyof UserProfile
  ): Promise<any> {
    try {
      const { data, error} = await this.supabase
        .from('profile')
        .select(section)
        .eq('id', userId)
        .single();

      if (error) {
        console.error(`❌ [ProfileService] Error getting section ${section}:`, error);
        return null;
      }

      return (data as any)?.[section] || null;
    } catch (error) {
      console.error(`❌ [ProfileService] Error getting section ${section}:`, error);
      return null;
    }
  }

  /**
   * Update a specific field in a JSONB column
   * Example: updateField(userId, "values", "coreValues", ["Growth", "Impact"])
   */
  async updateField(
    userId: string,
    column: string,
    field: string,
    value: any
  ): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      const columnData = (profile as any)[column] || {};
      columnData[field] = value;

      await this.updateProfile(userId, { [column]: columnData });
    } catch (error) {
      console.error(`❌ [ProfileService] Error updating field ${column}.${field}:`, error);
      throw error;
    }
  }

  /**
   * Batch update multiple fields
   */
  async batchUpdateFields(
    userId: string,
    updates: Array<{ column: string; field: string; value: any }>
  ): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      const changes: Record<string, any> = {};

      for (const update of updates) {
        if (!changes[update.column]) {
          changes[update.column] = (profile as any)[update.column] || {};
        }
        changes[update.column][update.field] = update.value;
      }

      await this.updateProfile(userId, changes);
    } catch (error) {
      console.error('❌ [ProfileService] Error batch updating fields:', error);
      throw error;
    }
  }

  /**
   * Get profile completeness percentage
   */
  async getProfileCompleteness(userId: string): Promise<number> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) {
        return 0;
      }

      const sections = ['values', 'preferences', 'work_patterns', 'personality_traits'];
      let totalFields = 0;
      let filledFields = 0;

      for (const section of sections) {
        const sectionData = (profile as any)[section];
        if (sectionData && typeof sectionData === 'object') {
          const keys = Object.keys(sectionData);
          totalFields += keys.length;
          filledFields += keys.filter(key => {
            const val = sectionData[key];
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === 'object' && val !== null) return Object.keys(val).length > 0;
            return val !== null && val !== undefined && val !== '';
          }).length;
        }
      }

      if (profile.goals_summary) filledFields++;
      totalFields++;

      return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
    } catch (error) {
      console.error('❌ [ProfileService] Error calculating completeness:', error);
      return 0;
    }
  }

  /**
   * Get a summary of the profile
   */
  async getProfileSummary(userId: string): Promise<any> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) {
        return {
          totalFields: 0,
          filledFields: 0,
          completenessPercentage: 0,
          sections: {}
        };
      }

      const sections = ['values', 'preferences', 'work_patterns', 'personality_traits', 'context_data'];
      const summary: any = {
        totalFields: 0,
        filledFields: 0,
        sections: {}
      };

      for (const section of sections) {
        const sectionData = (profile as any)[section];
        if (sectionData && typeof sectionData === 'object') {
          const keys = Object.keys(sectionData);
          const filled = keys.filter(key => {
            const val = sectionData[key];
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === 'object' && val !== null) return Object.keys(val).length > 0;
            return val !== null && val !== undefined && val !== '';
          }).length;

          summary.sections[section] = {
            totalFields: keys.length,
            filledFields: filled,
            completeness: keys.length > 0 ? Math.round((filled / keys.length) * 100) : 0
          };

          summary.totalFields += keys.length;
          summary.filledFields += filled;
        }
      }

      summary.completenessPercentage = summary.totalFields > 0
        ? Math.round((summary.filledFields / summary.totalFields) * 100)
        : 0;

      return summary;
    } catch (error) {
      console.error('❌ [ProfileService] Error generating summary:', error);
      return {
        totalFields: 0,
        filledFields: 0,
        completenessPercentage: 0,
        sections: {}
      };
    }
  }
}

export default new ProfileService();
