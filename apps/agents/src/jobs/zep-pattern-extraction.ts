/**
 * Zep Pattern Extraction Job
 *
 * Background job that analyzes user behavior from Supabase and extracts
 * behavioral patterns to store in Zep's knowledge graph.
 *
 * Pattern Types Extracted:
 * 1. SCHEDULING PATTERNS - When user prefers certain activity types
 *    - Time-of-day preferences by category
 *    - Day-of-week preferences
 *    - Duration patterns
 *
 * 2. PRODUCTIVITY PATTERNS - Task completion behavior
 *    - Completion rate by priority level
 *    - Most productive times
 *    - Category completion patterns
 *
 * Recommended frequency: Weekly
 *
 * Usage:
 *   npx tsx apps/agents/src/jobs/zep-pattern-extraction.ts
 */

import 'dotenv/config';
import { SupabaseService } from '../services/SupabaseService.js';
import { ZepGraphService } from '../services/ZepGraphService.js';

const BATCH_SIZE = 50;
const MAX_CONCURRENT_USERS = 3;
const MIN_DATA_POINTS = 5; // Minimum data points required for pattern detection
const MIN_CONFIDENCE = 0.6; // Minimum confidence to store a pattern

interface ExtractedPattern {
  pattern_key: string;
  pattern_type: string;
  description: string;
  confidence_score: number;
  frequency: string;
  time_of_day?: string;
  day_of_week?: string;
}

interface ExtractionResult {
  userId: string;
  schedulingPatterns: number;
  productivityPatterns: number;
  errors: string[];
}

interface ExtractionSummary {
  usersProcessed: number;
  totalSchedulingPatterns: number;
  totalProductivityPatterns: number;
  errors: string[];
}

async function runPatternExtraction(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[ZEP-PATTERNS] Starting pattern extraction job...');
  console.log(`[ZEP-PATTERNS] Min data points: ${MIN_DATA_POINTS}, Min confidence: ${MIN_CONFIDENCE}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const supabaseService = new SupabaseService();
  const supabase = supabaseService.getClient();

  const summary: ExtractionSummary = {
    usersProcessed: 0,
    totalSchedulingPatterns: 0,
    totalProductivityPatterns: 0,
    errors: [],
  };

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('profile')
      .select('id')
      .limit(BATCH_SIZE);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      console.log('[ZEP-PATTERNS] No users found\n');
      return;
    }

    console.log(`[ZEP-PATTERNS] Found ${users.length} users to analyze\n`);

    // Process users in batches
    for (let i = 0; i < users.length; i += MAX_CONCURRENT_USERS) {
      const batch = users.slice(i, i + MAX_CONCURRENT_USERS);
      const results = await Promise.all(
        batch.map(user => extractUserPatterns(user.id, supabaseService))
      );

      // Aggregate results
      results.forEach(result => {
        summary.usersProcessed++;
        summary.totalSchedulingPatterns += result.schedulingPatterns;
        summary.totalProductivityPatterns += result.productivityPatterns;
        summary.errors.push(...result.errors);
      });
    }

    // Log extraction to sync log
    await supabase.from('zep_sync_log').insert({
      user_id: null,
      entity_type: 'pattern_extraction',
      entity_id: null,
      operation: 'batch_extraction',
      status: summary.errors.length === 0 ? 'success' : 'partial',
      metadata: {
        users_processed: summary.usersProcessed,
        scheduling_patterns: summary.totalSchedulingPatterns,
        productivity_patterns: summary.totalProductivityPatterns,
        errors: summary.errors.slice(0, 10),
      },
    });

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('[ZEP-PATTERNS] Job Complete');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Users processed:          ${summary.usersProcessed}`);
    console.log(`Scheduling patterns:      ${summary.totalSchedulingPatterns}`);
    console.log(`Productivity patterns:    ${summary.totalProductivityPatterns}`);
    console.log(`Errors:                   ${summary.errors.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('[ZEP-PATTERNS] Job failed:', error);
    process.exit(1);
  }
}

async function extractUserPatterns(
  userId: string,
  supabaseService: SupabaseService
): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    userId,
    schedulingPatterns: 0,
    productivityPatterns: 0,
    errors: [],
  };

  console.log(`\n[ZEP-PATTERNS] Analyzing user: ${userId}`);

  const zepGraphService = new ZepGraphService();

  try {
    // Ensure user exists in Zep
    await zepGraphService.initializeUserWithRatings(userId);
  } catch (e) {
    // User may already exist, continue
  }

  // Extract scheduling patterns from events
  const schedulingPatterns = await extractSchedulingPatterns(userId, supabaseService);
  for (const pattern of schedulingPatterns) {
    try {
      await zepGraphService.addUserPattern(userId, pattern);
      result.schedulingPatterns++;
      console.log(`  [SCHEDULING] Added: ${pattern.description}`);
    } catch (e) {
      result.errors.push(`Scheduling pattern: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Extract productivity patterns from tasks
  const productivityPatterns = await extractProductivityPatterns(userId, supabaseService);
  for (const pattern of productivityPatterns) {
    try {
      await zepGraphService.addUserPattern(userId, pattern);
      result.productivityPatterns++;
      console.log(`  [PRODUCTIVITY] Added: ${pattern.description}`);
    } catch (e) {
      result.errors.push(`Productivity pattern: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[ZEP-PATTERNS] User ${userId}: ${result.schedulingPatterns} scheduling, ${result.productivityPatterns} productivity patterns`);

  return result;
}

/**
 * Extract scheduling patterns from calendar events
 */
async function extractSchedulingPatterns(
  userId: string,
  supabaseService: SupabaseService
): Promise<ExtractedPattern[]> {
  const patterns: ExtractedPattern[] = [];

  try {
    const events = await supabaseService.getEvents(userId);
    const now = new Date();

    // Only analyze past events (completed)
    const pastEvents = events.filter((e: any) => new Date(e.end_time) < now);

    if (pastEvents.length < MIN_DATA_POINTS) {
      console.log(`  [SCHEDULING] Insufficient data (${pastEvents.length} events)`);
      return patterns;
    }

    // 1. Analyze time-of-day preferences by category
    const categoryByTimeOfDay = new Map<string, Map<string, number>>();

    for (const event of pastEvents) {
      const hour = new Date(event.start_time).getHours();
      const category = event.category || 'general';
      const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

      if (!categoryByTimeOfDay.has(category)) {
        categoryByTimeOfDay.set(category, new Map());
      }
      const todCounts = categoryByTimeOfDay.get(category)!;
      todCounts.set(timeOfDay, (todCounts.get(timeOfDay) || 0) + 1);
    }

    // Find strong time-of-day preferences (>60% of category events)
    categoryByTimeOfDay.forEach((todCounts, category) => {
      const total = Array.from(todCounts.values()).reduce((a: number, b: number) => a + b, 0);
      if (total < MIN_DATA_POINTS) return;

      todCounts.forEach((count, timeOfDay) => {
        const confidence = count / total;
        if (confidence >= MIN_CONFIDENCE) {
          patterns.push({
            pattern_key: `scheduling_tod_${category}_${timeOfDay}`,
            pattern_type: 'scheduling_time_preference',
            description: `User schedules ${category} events in the ${timeOfDay} (${Math.round(confidence * 100)}% of ${total} events)`,
            confidence_score: confidence,
            frequency: 'observed',
            time_of_day: timeOfDay,
          });
        }
      });
    });

    // 2. Analyze day-of-week preferences by category
    const categoryByDayOfWeek = new Map<string, Map<string, number>>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const event of pastEvents) {
      const dayOfWeek = dayNames[new Date(event.start_time).getDay()];
      const category = event.category || 'general';

      if (!categoryByDayOfWeek.has(category)) {
        categoryByDayOfWeek.set(category, new Map());
      }
      const dowCounts = categoryByDayOfWeek.get(category)!;
      dowCounts.set(dayOfWeek, (dowCounts.get(dayOfWeek) || 0) + 1);
    }

    // Find strong day-of-week preferences
    categoryByDayOfWeek.forEach((dowCounts, category) => {
      const total = Array.from(dowCounts.values()).reduce((a: number, b: number) => a + b, 0);
      if (total < MIN_DATA_POINTS) return;

      // Check for avoided days (significantly below average)
      const avgPerDay = total / 7;
      dowCounts.forEach((count, dayOfWeek) => {
        if (count >= avgPerDay * 2 && count >= MIN_DATA_POINTS) {
          const confidence = Math.min(count / total * 2, 0.95);
          patterns.push({
            pattern_key: `scheduling_dow_${category}_${dayOfWeek.toLowerCase()}`,
            pattern_type: 'scheduling_day_preference',
            description: `User frequently schedules ${category} on ${dayOfWeek}s (${count} of ${total} events)`,
            confidence_score: confidence,
            frequency: 'weekly',
            day_of_week: dayOfWeek,
          });
        }
      });
    });

    // 3. Analyze average duration by category
    const categoryDurations = new Map<string, number[]>();

    for (const event of pastEvents) {
      const category = event.category || 'general';
      if (event.start_time && event.end_time) {
        const duration = (new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000;
        if (duration > 0 && duration < 480) { // Ignore invalid or very long events
          if (!categoryDurations.has(category)) {
            categoryDurations.set(category, []);
          }
          categoryDurations.get(category)!.push(duration);
        }
      }
    }

    categoryDurations.forEach((durations, category) => {
      if (durations.length < MIN_DATA_POINTS) return;

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const stdDev = Math.sqrt(
        durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length
      );

      // Low variance = consistent duration preference
      const consistency = 1 - Math.min(stdDev / avgDuration, 1);
      if (consistency >= 0.5) {
        patterns.push({
          pattern_key: `scheduling_duration_${category}`,
          pattern_type: 'scheduling_duration_preference',
          description: `User's ${category} events typically last ${Math.round(avgDuration)} minutes (based on ${durations.length} events)`,
          confidence_score: consistency,
          frequency: 'observed',
        });
      }
    });

  } catch (error) {
    console.error(`  [SCHEDULING] Error:`, error);
  }

  return patterns;
}

/**
 * Extract productivity patterns from tasks
 */
async function extractProductivityPatterns(
  userId: string,
  supabaseService: SupabaseService
): Promise<ExtractedPattern[]> {
  const patterns: ExtractedPattern[] = [];

  try {
    const tasks = await supabaseService.getTasks(userId);

    // Separate completed and incomplete tasks
    const completedTasks = tasks.filter((t: any) => t.status === 'completed');
    const allTasks = tasks;

    if (allTasks.length < MIN_DATA_POINTS) {
      console.log(`  [PRODUCTIVITY] Insufficient data (${allTasks.length} tasks)`);
      return patterns;
    }

    // 1. Overall completion rate
    const completionRate = completedTasks.length / allTasks.length;
    if (allTasks.length >= MIN_DATA_POINTS) {
      let rateDescription: string;
      if (completionRate >= 0.8) {
        rateDescription = 'excellent task completion rate';
      } else if (completionRate >= 0.6) {
        rateDescription = 'good task completion rate';
      } else if (completionRate >= 0.4) {
        rateDescription = 'moderate task completion rate';
      } else {
        rateDescription = 'low task completion rate';
      }

      patterns.push({
        pattern_key: 'productivity_completion_rate',
        pattern_type: 'productivity_completion',
        description: `User has ${rateDescription} (${Math.round(completionRate * 100)}% of ${allTasks.length} tasks completed)`,
        confidence_score: Math.min(allTasks.length / 20, 0.95), // More data = higher confidence
        frequency: 'ongoing',
      });
    }

    // 2. Completion rate by priority
    const priorityGroups = new Map<string, { completed: number; total: number }>();

    for (const task of allTasks) {
      const priority = task.priority || 'medium';
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, { completed: 0, total: 0 });
      }
      const group = priorityGroups.get(priority)!;
      group.total++;
      if (task.status === 'completed') {
        group.completed++;
      }
    }

    priorityGroups.forEach((stats, priority) => {
      if (stats.total < MIN_DATA_POINTS) return;

      const rate = stats.completed / stats.total;
      const confidence = Math.min(stats.total / 10, 0.9);

      if (rate >= 0.7) {
        patterns.push({
          pattern_key: `productivity_priority_${priority}`,
          pattern_type: 'productivity_priority_preference',
          description: `User completes ${priority} priority tasks at a high rate (${Math.round(rate * 100)}%)`,
          confidence_score: confidence,
          frequency: 'ongoing',
        });
      } else if (rate < 0.4) {
        patterns.push({
          pattern_key: `productivity_priority_${priority}_low`,
          pattern_type: 'productivity_priority_challenge',
          description: `User struggles with ${priority} priority tasks (only ${Math.round(rate * 100)}% completed)`,
          confidence_score: confidence,
          frequency: 'ongoing',
        });
      }
    });

    // 3. Completion rate by category
    const categoryGroups = new Map<string, { completed: number; total: number }>();

    for (const task of allTasks) {
      const category = task.category || 'uncategorized';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, { completed: 0, total: 0 });
      }
      const group = categoryGroups.get(category)!;
      group.total++;
      if (task.status === 'completed') {
        group.completed++;
      }
    }

    categoryGroups.forEach((stats, category) => {
      if (stats.total < MIN_DATA_POINTS) return;

      const rate = stats.completed / stats.total;
      const confidence = Math.min(stats.total / 10, 0.9);

      if (rate >= 0.75) {
        patterns.push({
          pattern_key: `productivity_category_${category.toLowerCase().replace(/\s+/g, '_')}`,
          pattern_type: 'productivity_category_strength',
          description: `User excels at completing ${category} tasks (${Math.round(rate * 100)}% completion rate)`,
          confidence_score: confidence,
          frequency: 'ongoing',
        });
      } else if (rate < 0.35) {
        patterns.push({
          pattern_key: `productivity_category_${category.toLowerCase().replace(/\s+/g, '_')}_low`,
          pattern_type: 'productivity_category_challenge',
          description: `User often defers ${category} tasks (only ${Math.round(rate * 100)}% completed)`,
          confidence_score: confidence,
          frequency: 'ongoing',
        });
      }
    });

    // 4. Analyze completion timing (if created_at and completed_at are available)
    const completedWithTiming = completedTasks.filter((t: any) => t.created_at && t.updated_at);
    if (completedWithTiming.length >= MIN_DATA_POINTS) {
      const completionTimes: number[] = [];

      for (const task of completedWithTiming) {
        const created = new Date(task.created_at).getTime();
        const completed = new Date(task.updated_at).getTime();
        const daysToComplete = (completed - created) / (1000 * 60 * 60 * 24);
        if (daysToComplete >= 0 && daysToComplete < 365) { // Reasonable range
          completionTimes.push(daysToComplete);
        }
      }

      if (completionTimes.length >= MIN_DATA_POINTS) {
        const avgDays = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;

        let speedDescription: string;
        if (avgDays < 1) {
          speedDescription = 'same-day task completer';
        } else if (avgDays < 3) {
          speedDescription = 'quick task completer (within a few days)';
        } else if (avgDays < 7) {
          speedDescription = 'steady task completer (within a week)';
        } else {
          speedDescription = 'deliberate task completer (takes time)';
        }

        patterns.push({
          pattern_key: 'productivity_completion_speed',
          pattern_type: 'productivity_timing',
          description: `User is a ${speedDescription} (average ${avgDays.toFixed(1)} days)`,
          confidence_score: Math.min(completionTimes.length / 15, 0.9),
          frequency: 'ongoing',
        });
      }
    }

  } catch (error) {
    console.error(`  [PRODUCTIVITY] Error:`, error);
  }

  return patterns;
}

// Run the job
runPatternExtraction()
  .then(() => {
    console.log('[ZEP-PATTERNS] Job completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('[ZEP-PATTERNS] Job failed:', error);
    process.exit(1);
  });
