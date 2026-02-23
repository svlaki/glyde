import { getSupabaseService } from './SupabaseService.js';
import { AspectService } from './AspectService.js';
import { ZepOnboardingSeedService } from './ZepOnboardingSeedService.js';

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

// Enriched aspect/goal types (with optional descriptions from onboarding)
interface AspectItem {
  name: string;
  description?: string;
}

interface GoalItem {
  title: string;
  description?: string;
}

// V2 Onboarding data interface (new structure)
// aspects/goals accept both plain strings (backward compat) and enriched objects
export interface OnboardingDataV2 {
  fullName: string;
  preferredName?: string;
  birthday: string;
  selectedCalendars: string[];
  otherCalendar?: string;
  occupation: string;
  fieldOfStudy?: string;
  aspects: string[];
  goals: string[];
  timezone: string;
}

export class OnboardingService {
  /** Normalize aspects input to enriched format */
  private static normalizeAspects(aspects: AspectItem[] | string[]): AspectItem[] {
    return aspects.map(a =>
      typeof a === 'string' ? { name: a } : a
    );
  }

  /** Normalize goals input to enriched format */
  private static normalizeGoals(goals: GoalItem[] | string[]): GoalItem[] {
    return goals.map(g =>
      typeof g === 'string' ? { title: g } : g
    );
  }

  /** Extract goal titles as plain strings for summary generation */
  private static getGoalTitles(goals: GoalItem[] | string[]): string[] {
    return goals.map(g => typeof g === 'string' ? g : g.title);
  }

  /** Extract aspect names as plain strings */
  private static getAspectNames(aspects: AspectItem[] | string[]): string[] {
    return aspects.map(a => typeof a === 'string' ? a : a.name);
  }

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

    // Create aspects for each life aspect
    await this.createAspectsFromSelection(userId, this.normalizeAspects(data.aspects));

    // Create goals in the user's schema
    await this.createGoalsForUser(userId, this.normalizeGoals(data.goals));
  }

  /**
   * Complete V2 onboarding (new structure with birthday)
   * Wipes previous onboarding data and starts fresh
   */
  static async completeOnboardingV2(userId: string, data: OnboardingDataV2): Promise<void> {
    const supabase = getSupabaseService().getClient();

    console.log(`Starting V2 onboarding for user ${userId} - clearing previous data...`);

    // Normalize enriched data
    const normalizedAspects = this.normalizeAspects(data.aspects);
    const normalizedGoals = this.normalizeGoals(data.goals);
    const goalTitles = this.getGoalTitles(data.goals);
    const aspectNames = this.getAspectNames(data.aspects);

    // Step 1: Clear previous onboarding data
    await this.clearPreviousOnboardingData(userId);

    // Step 2: Generate goals summary from goals array
    const goals_summary = this.generateGoalsSummary(goalTitles);

    // Step 3: Prepare context data (only for non-column data)
    const context_data = {
      onboarding: {
        completed_at: new Date().toISOString(),
        version: '2.0',
        steps_completed: ['basic_info', 'calendars', 'habits_goals']
      },
      life_aspects: aspectNames,
      calendar_imported: false,
      selected_calendars: data.selectedCalendars,
      other_calendar: data.otherCalendar
    };

    // Step 4: Update profile with all onboarding data using proper columns
    const { error } = await supabase
      .from('profile')
      .update({
        display_name: data.preferredName || data.fullName,
        preferred_name: data.preferredName || null,
        birthday: data.birthday,
        occupation: data.occupation,
        field_of_study: data.fieldOfStudy || null,
        timezone: data.timezone,
        goals_summary: goals_summary,
        context_data: context_data
      })
      .eq('id', userId);

    if (error) {
      console.error('Error completing V2 onboarding:', error);
      throw new Error(`Failed to complete onboarding: ${error.message}`);
    }

    // Step 5: Create aspects for each life aspect (with descriptions)
    await this.createAspectsFromSelection(userId, normalizedAspects);

    // Step 6: Create goals in the user's schema (with descriptions)
    await this.createGoalsForUser(userId, normalizedGoals);

    console.log(`Completed V2 onboarding for user ${userId}`);

    // Step 7: Seed Zep memory with onboarding data (non-blocking)
    try {
      const zepSeedService = new ZepOnboardingSeedService();
      const seedResult = await zepSeedService.seedOnboardingData(userId, data, goals_summary);

      if (!seedResult.success) {
        console.warn(`Zep seeding failed for user ${userId}:`, seedResult.errors);
      }
    } catch (error: any) {
      // Log but don't fail onboarding - Zep seeding is non-critical
      console.error(`Zep seeding error for user ${userId}:`, error.message);
    }
  }

  /**
   * Clear all previous onboarding data for a user
   * This ensures a fresh start when re-onboarding
   */
  private static async clearPreviousOnboardingData(userId: string): Promise<void> {
    const supabase = getSupabaseService().getClient();

    // NOTE: We intentionally DO NOT delete aspects or goals here
    // Users may have existing data they want to preserve across re-onboarding
    // Aspects and goals are created additively during onboarding
    console.log(`Preserving existing aspects and goals for user`);

    // Reset profile onboarding-related fields
    const { error: profileError } = await supabase
      .from('profile')
      .update({
        display_name: null,
        preferred_name: null,
        birthday: null,
        occupation: null,
        field_of_study: null,
        goals_summary: null,
        context_data: {},
        preferences: {},
        work_patterns: {},
        personality_traits: {}
      })
      .eq('id', userId);

    if (profileError) {
      console.warn(`Failed to reset profile: ${profileError.message}`);
    } else {
      console.log(`Reset profile fields for user`);
    }
  }

  /**
   * Create goals for the user in their schema
   * Checks for existing goals with same title to prevent duplicates
   */
  private static async createGoalsForUser(userId: string, goals: GoalItem[]): Promise<void> {
    const supabase = getSupabaseService();

    // Get existing goals to check for duplicates
    const existingGoals = await supabase.getGoals(userId);
    const existingTitles = new Set(existingGoals.map((g: any) => g.title?.toLowerCase()));

    console.log(`Creating goals for user (${existingGoals.length} existing, ${goals.length} new)...`);

    for (const goal of goals) {
      // Skip if goal with same title already exists
      if (existingTitles.has(goal.title.toLowerCase())) {
        console.log(`Skipping duplicate goal: ${goal.title}`);
        continue;
      }

      try {
        await supabase.createGoal(userId, {
          title: goal.title,
          description: goal.description,
          status: 'active',
          goalType: 'SMART',
          progress: 0,
          priorityScore: 5
        });
        console.log(`Created goal: ${goal.title}`);
      } catch (error: any) {
        // Don't fail the whole onboarding if one goal fails
        console.error(`Failed to create goal "${goal.title}":`, error.message);
      }
    }
  }

  /**
   * Create aspects for the selected life aspects
   * NOTE: Skips if user already has aspects to preserve existing setup during re-onboarding
   */
  private static async createAspectsFromSelection(userId: string, aspects: AspectItem[]): Promise<void> {
    const aspectService = new AspectService();

    // Check if user already has aspects - if so, preserve them completely
    const existingAspects = await aspectService.getAspects(userId);
    if (existingAspects && existingAspects.length > 0) {
      console.log(`User already has ${existingAspects.length} aspects, preserving existing setup`);
      return;
    }

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

    console.log(`Creating ${aspects.length} aspects...`);

    for (let i = 0; i < aspects.length; i++) {
      const aspect = aspects[i];
      const color = aspectColors[aspect.name] || defaultColors[i % defaultColors.length];
      const description = aspect.description || `${aspect.name} activities and events`;

      try {
        // Use upsert to handle duplicates gracefully
        await aspectService.upsertAspect(userId, {
          name: aspect.name,
          color: color,
          description: description,
        });
        console.log(`Created/updated aspect: ${aspect.name}`);
      } catch (error: any) {
        // Don't fail the whole onboarding if one aspect fails
        console.error(`Failed to create aspect ${aspect.name}:`, error.message);
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
