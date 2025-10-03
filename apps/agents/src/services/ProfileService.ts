import { SupabaseClient } from '@supabase/supabase-js';
import { AIContextProfile, ProfileSection, ProfileFieldUpdate } from '../types/profile.js';
import { getSupabaseClient } from './SupabaseService.js';

export class ProfileService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get the complete AI context profile for a user
   */
  async getProfile(userId: string): Promise<AIContextProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('profile')
        .select('ai_context_profile')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ [ProfileService] Error fetching profile:', error);
        return null;
      }

      return data?.ai_context_profile as AIContextProfile;
    } catch (error) {
      console.error('❌ [ProfileService] Exception fetching profile:', error);
      return null;
    }
  }

  /**
   * Update the entire AI context profile
   */
  async updateProfile(userId: string, profile: AIContextProfile): Promise<void> {
    try {
      // Set lastUpdated timestamp
      profile.lastUpdated = new Date().toISOString();

      const { error } = await this.supabase
        .from('profile')
        .update({ ai_context_profile: profile })
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
   * Update a specific section of the profile
   */
  async updateProfileSection(
    userId: string,
    section: ProfileSection,
    data: any
  ): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Update the specific section
      profile[section] = data;
      profile.lastUpdated = new Date().toISOString();

      await this.updateProfile(userId, profile);
    } catch (error) {
      console.error(`❌ [ProfileService] Error updating section ${section}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific section of the profile
   */
  async getProfileSection(userId: string, section: ProfileSection): Promise<any> {
    try {
      const profile = await this.getProfile(userId);
      return profile?.[section] || null;
    } catch (error) {
      console.error(`❌ [ProfileService] Error getting section ${section}:`, error);
      return null;
    }
  }

  /**
   * Update a specific field in the profile using JSON path
   * Example: updateField(userId, "productivity.peakFocusHours", [9, 10, 11])
   */
  async updateField(userId: string, path: string, value: any): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Navigate to the nested field and update it
      const pathParts = path.split('.');
      let current: any = profile;

      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!(pathParts[i] in current)) {
          current[pathParts[i]] = {};
        }
        current = current[pathParts[i]];
      }

      // Set the final value
      current[pathParts[pathParts.length - 1]] = value;

      await this.updateProfile(userId, profile);
    } catch (error) {
      console.error(`❌ [ProfileService] Error updating field ${path}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific field value from the profile
   */
  async getField(userId: string, path: string): Promise<any> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) {
        return null;
      }

      // Navigate to the nested field
      const pathParts = path.split('.');
      let current: any = profile;

      for (const part of pathParts) {
        if (!(part in current)) {
          return null;
        }
        current = current[part];
      }

      return current;
    } catch (error) {
      console.error(`❌ [ProfileService] Error getting field ${path}:`, error);
      return null;
    }
  }

  /**
   * Batch update multiple fields
   */
  async batchUpdateFields(userId: string, updates: ProfileFieldUpdate[]): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Apply all updates
      for (const update of updates) {
        const pathParts = update.path.split('.');
        let current: any = profile;

        for (let i = 0; i < pathParts.length - 1; i++) {
          if (!(pathParts[i] in current)) {
            current[pathParts[i]] = {};
          }
          current = current[pathParts[i]];
        }

        current[pathParts[pathParts.length - 1]] = update.value;
      }

      await this.updateProfile(userId, profile);
    } catch (error) {
      console.error('❌ [ProfileService] Error batch updating fields:', error);
      throw error;
    }
  }

  /**
   * Check if a profile field has been set (not null/empty)
   */
  async isFieldSet(userId: string, path: string): Promise<boolean> {
    const value = await this.getField(userId, path);

    if (value === null || value === undefined) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }

    return true;
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

      // Define critical fields to check
      const criticalFields = [
        'life.coreValues',
        'life.currentLifePhase',
        'work.role',
        'work.workingHours.start',
        'productivity.peakFocusHours',
        'productivity.energyPattern.morning',
        'health.exerciseRoutine.frequency',
        'health.sleepSchedule.targetBedtime',
        'agentPreferences.proactivityLevel',
      ];

      let filledCount = 0;

      for (const field of criticalFields) {
        if (await this.isFieldSet(userId, field)) {
          filledCount++;
        }
      }

      return Math.round((filledCount / criticalFields.length) * 100);
    } catch (error) {
      console.error('❌ [ProfileService] Error calculating completeness:', error);
      return 0;
    }
  }

  /**
   * Get a summary of what the AI knows about the user
   */
  async getProfileSummary(userId: string): Promise<string> {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) {
        return 'No profile information available.';
      }

      const summary: string[] = [];

      // Life context
      if (profile.life.coreValues.length > 0) {
        summary.push(`Values: ${profile.life.coreValues.join(', ')}`);
      }

      // Work
      if (profile.work.role) {
        summary.push(`Role: ${profile.work.role}${profile.work.company ? ` at ${profile.work.company}` : ''}`);
      }

      // Productivity
      if (profile.productivity.peakFocusHours.length > 0) {
        summary.push(`Peak focus: ${profile.productivity.peakFocusHours.join(', ')}:00`);
      }

      // Health
      if (profile.health.exerciseRoutine.types.length > 0) {
        summary.push(`Exercise: ${profile.health.exerciseRoutine.types.join(', ')} ${profile.health.exerciseRoutine.frequency || ''}`);
      }

      // Goals
      const totalGoals = profile.life.lifeGoals.shortTerm.length +
        profile.life.lifeGoals.mediumTerm.length +
        profile.life.lifeGoals.longTerm.length;
      if (totalGoals > 0) {
        summary.push(`${totalGoals} life goals tracked`);
      }

      return summary.length > 0
        ? summary.join(' • ')
        : 'Profile is being built as you interact with the system.';
    } catch (error) {
      console.error('❌ [ProfileService] Error generating summary:', error);
      return 'Error loading profile summary.';
    }
  }
}

export default new ProfileService();
