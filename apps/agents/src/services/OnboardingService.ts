import { getSupabaseService } from './SupabaseService.js';
import { CategoryService } from './CategoryService.js';

export interface OnboardingData {
  name: string;
  occupation: string;
  goals: string[];
  aspects: string[];
  timezone: string;
  preferences: {
    work_hours: {
      start: string;
      end: string;
      flexible: boolean;
    };
    communication: {
      style: 'direct' | 'collaborative' | 'formal' | 'casual';
      preferred_channels: string[];
    };
    productivity: {
      focus_block_duration: number;
      break_frequency: number;
      meeting_preference: 'morning' | 'afternoon' | 'flexible';
      deep_work_time: 'morning' | 'afternoon' | 'evening';
    };
  };
}

export class OnboardingService {
  /**
   * Complete onboarding by saving all user data to the profile table
   */
  static async completeOnboarding(userId: string, data: OnboardingData): Promise<void> {
    const supabase = getSupabaseService().getClient();

    // Generate goals summary from goals array
    const goals_summary = this.generateGoalsSummary(data.goals);

    // Prepare context data
    const context_data = {
      onboarding: {
        completed_at: new Date().toISOString(),
        version: '1.0',
        steps_completed: ['basic_info', 'goals', 'aspects', 'timezone', 'preferences'],
        calendar_source: 'none' // Will be updated if calendar is imported
      },
      life_aspects: data.aspects,
      calendar_imported: false
    };

    // Update profile with all onboarding data
    const { error } = await supabase
      .from('profile')
      .update({
        display_name: data.name,
        timezone: data.timezone,
        preferences: data.preferences,
        goals_summary: goals_summary,
        context_data: context_data
      })
      .eq('id', userId);

    if (error) {
      console.error('Error completing onboarding:', error);
      throw new Error(`Failed to complete onboarding: ${error.message}`);
    }

    // Create categories for each aspect
    await this.createCategoriesForAspects(userId, data.aspects);

    // Create goals in the user's schema
    await this.createGoalsForUser(userId, data.goals);
  }

  /**
   * Create goals for the user in their schema
   */
  private static async createGoalsForUser(userId: string, goals: string[]): Promise<void> {
    const supabase = getSupabaseService();

    console.log(`Creating ${goals.length} goals for user...`);

    for (const goalTitle of goals) {
      try {
        await supabase.createGoal(userId, {
          title: goalTitle,
          description: `Goal created during onboarding`,
          status: 'active',
          goalType: 'SMART',
          progress: 0,
          priorityScore: 5
        });
        console.log(`✅ Created goal: ${goalTitle}`);
      } catch (error: any) {
        // Don't fail the whole onboarding if one goal fails
        console.error(`⚠️  Failed to create goal "${goalTitle}":`, error.message);
      }
    }
  }

  /**
   * Create categories for the selected aspects
   */
  private static async createCategoriesForAspects(userId: string, aspects: string[]): Promise<void> {
    const categoryService = new CategoryService();

    // Predefined colors for common aspects
    const aspectColors: Record<string, string> = {
      'Personal': '#10b981',
      'Health': '#ef4444',
      'Work': '#3b82f6',
      'School': '#8b5cf6',
      'Family': '#ec4899',
      'Social': '#f97316',
      'Finance': '#10b981',
      'Fitness': '#f59e0b',
      'Learning': '#8b5cf6'
    };

    // Default colors to cycle through if aspect not in predefined list
    const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

    console.log(`Creating categories for ${aspects.length} aspects...`);

    for (let i = 0; i < aspects.length; i++) {
      const aspect = aspects[i];
      const color = aspectColors[aspect] || defaultColors[i % defaultColors.length];
      const icon = aspect.charAt(0).toUpperCase(); // Use first letter as icon

      try {
        await categoryService.createCategory(userId, {
          name: aspect,
          color: color,
          icon: icon,
          description: `${aspect} activities and events`
        });
        console.log(`✅ Created category for aspect: ${aspect}`);
      } catch (error: any) {
        // Don't fail the whole onboarding if one category fails
        // This might happen if the category already exists
        console.error(`⚠️  Failed to create category for aspect ${aspect}:`, error.message);
      }
    }
  }

  /**
   * Generate a text summary from an array of goals
   */
  static generateGoalsSummary(goals: string[]): string {
    if (goals.length === 0) {
      return 'No goals specified yet.';
    }

    if (goals.length === 1) {
      return `My main goal is to ${goals[0].toLowerCase()}.`;
    }

    if (goals.length === 2) {
      return `My main goals are to ${goals[0].toLowerCase()} and ${goals[1].toLowerCase()}.`;
    }

    // For 3 or more goals
    const lastGoal = goals[goals.length - 1];
    const otherGoals = goals.slice(0, -1);
    return `My main goals are to ${otherGoals.map(g => g.toLowerCase()).join(', ')}, and ${lastGoal.toLowerCase()}.`;
  }

  /**
   * Update onboarding metadata after calendar import
   */
  static async updateCalendarImportMetadata(
    userId: string,
    source: 'google' | 'outlook' | 'ics',
    eventCount: number,
    dateRange: { start: string; end: string }
  ): Promise<void> {
    const supabase = getSupabaseService().getClient();

    // Get existing context_data
    const { data: profile, error: fetchError } = await supabase
      .from('profile')
      .select('context_data')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      throw new Error(`Failed to fetch profile: ${fetchError.message}`);
    }

    // Update context_data with calendar import info
    const updatedContextData = {
      ...profile.context_data,
      onboarding: {
        ...profile.context_data?.onboarding,
        calendar_source: source
      },
      calendar_imported: true,
      import_metadata: {
        source,
        event_count: eventCount,
        date_range: dateRange
      }
    };

    // Save updated context_data
    const { error: updateError } = await supabase
      .from('profile')
      .update({
        context_data: updatedContextData
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating calendar metadata:', updateError);
      throw new Error(`Failed to update calendar metadata: ${updateError.message}`);
    }
  }

  /**
   * Save step data progressively (called after each step)
   */
  static async saveStepData(
    userId: string,
    step: string,
    data: any
  ): Promise<void> {
    const supabase = getSupabaseService().getClient();

    // Determine which fields to update based on step
    let updateData: any = {};

    switch (step) {
      case 'basic_info':
        updateData.display_name = data.name;
        break;

      case 'goals':
        updateData.goals_summary = this.generateGoalsSummary(data.goals);
        break;

      case 'aspects':
        // Update context_data with life aspects
        const { data: profile } = await supabase
          .from('profile')
          .select('context_data')
          .eq('id', userId)
          .single();

        updateData.context_data = {
          ...(profile?.context_data || {}),
          life_aspects: data.aspects
        };
        break;

      case 'timezone':
        updateData.timezone = data.timezone;
        break;

      case 'preferences':
        updateData.preferences = data.preferences;
        break;

      default:
        console.warn(`Unknown step: ${step}`);
        return;
    }

    const { error } = await supabase
      .from('profile')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error(`Error saving step ${step}:`, error);
      throw new Error(`Failed to save step ${step}: ${error.message}`);
    }
  }
}
