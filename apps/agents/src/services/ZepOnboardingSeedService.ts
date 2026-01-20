/**
 * ZepOnboardingSeedService - Seeds Zep memory during user onboarding
 *
 * Dual approach:
 * 1. Thread-based: Add onboarding facts as a user message for natural language retrieval
 * 2. Graph-based: Store structured entities (UserPreference, Goal, Pattern) in knowledge graph
 */

import { ZepMemoryService } from './ZepMemoryService.js';
import { ZepGraphService } from './ZepGraphService.js';
import type { OnboardingDataV2 } from './OnboardingService.js';

export interface ZepOnboardingSeedResult {
  success: boolean;
  threadSeeded: boolean;
  graphSeeded: boolean;
  errors: string[];
}

// Habit ID to human-readable description mapping
const HABIT_DESCRIPTIONS: Record<string, string> = {
  'deadlines': 'I struggle to stay on top of deadlines',
  'task-switching': 'I find it difficult to switch tasks quickly',
  'procrastinator': 'I am a huge procrastinator',
  'easily-distracted': 'I get easily distracted',
  'poor-time-estimation': 'I often underestimate how long tasks take',
  'overcommit': 'I tend to overcommit myself',
  'forget-tasks': 'I frequently forget tasks or appointments',
  'work-life-balance': 'I struggle with work-life balance',
  'perfectionist': 'I spend too much time perfecting things',
  'energy-management': 'I have trouble managing my energy throughout the day'
};

export class ZepOnboardingSeedService {
  private memoryService: ZepMemoryService;
  private graphService: ZepGraphService;

  constructor() {
    this.memoryService = new ZepMemoryService();
    this.graphService = new ZepGraphService();
  }

  /**
   * Main entry point: Seeds both thread and graph with onboarding data
   * Called AFTER successful Supabase profile update
   */
  async seedOnboardingData(
    userId: string,
    data: OnboardingDataV2,
    goalsSummary: string
  ): Promise<ZepOnboardingSeedResult> {
    const result: ZepOnboardingSeedResult = {
      success: false,
      threadSeeded: false,
      graphSeeded: false,
      errors: []
    };

    console.log(`🌱 [ZepOnboardingSeed] Starting Zep seeding for user ${userId}...`);

    // Seed thread-based facts (for natural language context retrieval)
    try {
      await this.seedThreadFacts(userId, data, goalsSummary);
      result.threadSeeded = true;
    } catch (error: any) {
      console.error(`[ZepOnboardingSeed] Thread seeding failed for ${userId}:`, error);
      result.errors.push(`Thread seeding failed: ${error.message}`);
    }

    // Seed graph entities (for structured queries)
    try {
      await this.seedGraphEntities(userId, data);
      result.graphSeeded = true;
    } catch (error: any) {
      console.error(`[ZepOnboardingSeed] Graph seeding failed for ${userId}:`, error);
      result.errors.push(`Graph seeding failed: ${error.message}`);
    }

    result.success = result.threadSeeded || result.graphSeeded;

    if (result.success) {
      console.log(`✅ [ZepOnboardingSeed] Completed for user ${userId} (thread: ${result.threadSeeded}, graph: ${result.graphSeeded})`);
    } else {
      console.warn(`⚠️ [ZepOnboardingSeed] Both seeding methods failed for user ${userId}`);
    }

    return result;
  }

  /**
   * Seeds thread with natural language onboarding facts
   * These will be retrieved via thread.getUserContext() during conversations
   */
  private async seedThreadFacts(
    userId: string,
    data: OnboardingDataV2,
    goalsSummary: string
  ): Promise<void> {
    // Initialize user in Zep with basic info
    const firstName = data.preferredName || data.fullName.split(' ')[0];
    const lastName = data.fullName.split(' ').slice(1).join(' ') || undefined;

    await this.memoryService.initUser(userId, {
      firstName,
      lastName,
      metadata: {
        onboarding_completed: new Date().toISOString(),
        timezone: data.timezone
      }
    });

    // Compose natural language onboarding summary
    const onboardingMessage = this.composeOnboardingMessage(data, goalsSummary);

    // Add as a user message to establish context
    // Using 'user' role so Zep extracts facts about the user
    await this.memoryService.addUserMessage(userId, onboardingMessage, {
      source: 'onboarding',
      onboarding_version: '2.0',
      seeded_at: new Date().toISOString()
    });

    console.log(`✅ [ZepOnboardingSeed] Thread facts seeded for user ${userId}`);
  }

  /**
   * Composes a natural language message containing all onboarding facts
   */
  private composeOnboardingMessage(data: OnboardingDataV2, goalsSummary: string): string {
    const lines: string[] = [];

    // Basic identity
    if (data.preferredName && data.preferredName !== data.fullName) {
      lines.push(`My name is ${data.fullName} but I prefer to be called ${data.preferredName}.`);
    } else {
      lines.push(`My name is ${data.fullName}.`);
    }

    // Demographics - age from birthday
    if (data.birthday) {
      const age = this.calculateAge(data.birthday);
      lines.push(`I am ${age} years old.`);
    }

    if (data.gender && data.gender.toLowerCase() !== 'prefer not to say') {
      lines.push(`I identify as ${data.gender.toLowerCase()}.`);
    }

    // Occupation and education
    lines.push(`I work as a ${data.occupation}.`);
    if (data.fieldOfStudy) {
      lines.push(`I am studying ${data.fieldOfStudy}.`);
    }

    // Life aspects
    if (data.aspects && data.aspects.length > 0) {
      lines.push(`The key areas of my life I want to manage are: ${data.aspects.join(', ')}.`);
    }

    // Goals
    if (goalsSummary) {
      lines.push(goalsSummary);
    }

    // Habits/challenges - translate IDs to human-readable descriptions
    if (data.habits && data.habits.length > 0) {
      const habitDescriptions = data.habits
        .map(id => HABIT_DESCRIPTIONS[id] || id)
        .filter(desc => desc);
      if (habitDescriptions.length > 0) {
        lines.push(`Some challenges I face: ${habitDescriptions.join('; ')}.`);
      }
    }

    // Timezone
    if (data.timezone) {
      lines.push(`I am in the ${data.timezone} timezone.`);
    }

    // Calendar preferences
    if (data.selectedCalendars && data.selectedCalendars.length > 0) {
      const calendars = data.selectedCalendars.filter(c => c.toLowerCase() !== 'none');
      if (calendars.length > 0) {
        lines.push(`I use ${calendars.join(' and ')} for my calendar.`);
      }
    }

    return lines.join(' ');
  }

  /**
   * Seeds structured entities in Zep graph
   */
  private async seedGraphEntities(userId: string, data: OnboardingDataV2): Promise<void> {
    // Seed UserPreference entities for demographics and settings
    await this.seedUserPreferences(userId, data);

    // Seed Goal entities
    if (data.goals && data.goals.length > 0) {
      await this.seedGoals(userId, data.goals);
    }

    // Seed habit patterns
    if (data.habits && data.habits.length > 0) {
      await this.seedHabitPatterns(userId, data.habits);
    }

    console.log(`✅ [ZepOnboardingSeed] Graph entities seeded for user ${userId}`);
  }

  /**
   * Seeds UserPreference entities for demographic and profile data
   */
  private async seedUserPreferences(userId: string, data: OnboardingDataV2): Promise<void> {
    const preferences: Array<{
      preference_type: string;
      key: string;
      value: string;
      importance: string;
    }> = [];

    // Identity preferences
    preferences.push({
      preference_type: 'identity',
      key: 'full_name',
      value: data.fullName,
      importance: 'high'
    });

    preferences.push({
      preference_type: 'identity',
      key: 'preferred_name',
      value: data.preferredName || data.fullName,
      importance: 'high'
    });

    // Demographic preferences
    if (data.birthday) {
      preferences.push({
        preference_type: 'demographic',
        key: 'birthday',
        value: data.birthday,
        importance: 'medium'
      });
    }

    if (data.gender) {
      preferences.push({
        preference_type: 'demographic',
        key: 'gender',
        value: data.gender,
        importance: 'low'
      });
    }

    // Work/occupation
    preferences.push({
      preference_type: 'work',
      key: 'occupation',
      value: data.occupation,
      importance: 'high'
    });

    if (data.fieldOfStudy) {
      preferences.push({
        preference_type: 'education',
        key: 'field_of_study',
        value: data.fieldOfStudy,
        importance: 'medium'
      });
    }

    // Scheduling
    if (data.timezone) {
      preferences.push({
        preference_type: 'scheduling',
        key: 'timezone',
        value: data.timezone,
        importance: 'high'
      });
    }

    // Life aspects as preferences
    if (data.aspects) {
      for (const aspect of data.aspects) {
        preferences.push({
          preference_type: 'life_aspect',
          key: aspect.toLowerCase().replace(/[\/\s]+/g, '_'),
          value: aspect,
          importance: 'high'
        });
      }
    }

    // Calendar preferences
    if (data.selectedCalendars && data.selectedCalendars.length > 0) {
      const calendars = data.selectedCalendars.filter(c => c.toLowerCase() !== 'none');
      if (calendars.length > 0) {
        preferences.push({
          preference_type: 'tools',
          key: 'calendars',
          value: calendars.join(','),
          importance: 'medium'
        });
      }
    }

    // Add each preference to graph
    for (const pref of preferences) {
      try {
        await this.graphService.addUserPreference(userId, pref);
      } catch (error: any) {
        console.warn(`[ZepOnboardingSeed] Failed to add preference ${pref.key}:`, error.message);
        // Continue with other preferences
      }
    }
  }

  /**
   * Seeds Goal entities from onboarding goals
   */
  private async seedGoals(userId: string, goals: string[]): Promise<void> {
    for (const goalTitle of goals) {
      try {
        await this.graphService.addGoal(userId, {
          title: goalTitle,
          goal_type: 'onboarding',
          status: 'active',
          progress_percentage: 0
        });
      } catch (error: any) {
        console.warn(`[ZepOnboardingSeed] Failed to add goal "${goalTitle}":`, error.message);
        // Continue with other goals
      }
    }
  }

  /**
   * Seeds habit patterns as Pattern entities
   */
  private async seedHabitPatterns(userId: string, habitIds: string[]): Promise<void> {
    for (const habitId of habitIds) {
      try {
        const description = HABIT_DESCRIPTIONS[habitId] || habitId;
        await this.graphService.addUserPattern(userId, {
          pattern_type: 'self_reported_challenge',
          description: description,
          confidence_score: 0.9, // High confidence - user self-reported
          frequency: 'ongoing'
        });
      } catch (error: any) {
        console.warn(`[ZepOnboardingSeed] Failed to add habit pattern "${habitId}":`, error.message);
        // Continue with other habits
      }
    }
  }

  /**
   * Helper: Calculate age from birthday
   */
  private calculateAge(birthday: string): number {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
}
