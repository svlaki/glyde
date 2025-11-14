import { addDays, addHours } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { ProactiveStrategy, StrategyContext } from './ProactiveStrategy.js';
import { InteractionCreationResult } from '../types.js';
import { findFreeSlot } from '../utils/timeSlotFinder.js';

/**
 * Strategy for suggesting focus time blocks for tasks with upcoming due dates.
 * Prioritizes tasks that are due soon or overdue.
 */
export class TaskFocusStrategy extends ProactiveStrategy {
  readonly name = 'TaskFocusStrategy';
  readonly priority = 8; // High priority - tasks are time-sensitive

  canRun(context: StrategyContext): boolean {
    // Only run if there are tasks and we have capacity to create interactions
    return context.tasks.length > 0 && context.limit > 0;
  }

  async execute(context: StrategyContext): Promise<InteractionCreationResult[]> {
    const { agentContext, timezone, events, tasks, existingKeys, limit, supabaseService } = context;

    console.log('[TaskFocusStrategy] Total tasks:', tasks.length, 'Limit:', limit);

    if (tasks.length === 0 || limit <= 0) {
      console.log('[TaskFocusStrategy] Skipping - no tasks or limit reached');
      return [];
    }

    const now = new Date();
    const threeDaysOut = addDays(now, 3);
    const sevenDaysAgo = addDays(now, -7);

    console.log('[TaskFocusStrategy] Date range for due tasks:', {
      sevenDaysAgo: sevenDaysAgo.toISOString(),
      now: now.toISOString(),
      threeDaysOut: threeDaysOut.toISOString()
    });

    // Filter tasks that are pending/in-progress and due soon or overdue
    const dueSoonTasks = tasks
      .filter((task: any) => ['pending', 'in_progress'].includes(task.status))
      .filter((task: any) => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        // Include overdue tasks (up to 7 days old) AND upcoming tasks (within next 3 days)
        return dueDate.getTime() >= sevenDaysAgo.getTime() && dueDate.getTime() <= threeDaysOut.getTime();
      })
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    console.log('[TaskFocusStrategy] Tasks due soon:', dueSoonTasks.length);
    if (dueSoonTasks.length > 0) {
      console.log('[TaskFocusStrategy] Due soon sample:', dueSoonTasks.slice(0, 3).map((t: any) => ({
        title: t.title,
        due_date: t.due_date,
        estimated_duration: t.estimated_duration
      })));
    }

    const created: InteractionCreationResult[] = [];

    for (const task of dueSoonTasks) {
      if (created.length >= limit) break;

      const key = `schedule_task_focus:${task.id}`;
      if (existingKeys.has(key)) {
        continue;
      }

      const durationMinutes = task.estimated_duration || 60;

      // Try to find time today first, then tomorrow
      let slot = findFreeSlot(events, timezone, { dayOffset: 0, durationMinutes });
      if (!slot) {
        slot = findFreeSlot(events, timezone, { dayOffset: 1, durationMinutes });
      }

      if (!slot) {
        continue; // No available slot found
      }

      // Convert local times to UTC
      const startUtc = fromZonedTime(slot.startLocal, timezone);
      const endUtc = fromZonedTime(slot.endLocal, timezone);

      const isTomorrow = startUtc.getDate() !== now.getDate();
      const readableTime = formatInTimeZone(startUtc, timezone, 'EEEE p');
      const dueLabel = formatInTimeZone(
        fromZonedTime(new Date(task.due_date), timezone),
        timezone,
        'EEEE, MMM d'
      );

      const question = `"${task.title}" is due ${dueLabel}. I found a ${durationMinutes}-minute focus block ${isTomorrow ? 'tomorrow' : 'today'} at ${formatInTimeZone(startUtc, timezone, 'p')}. Should I schedule it?`;

      const interaction = await supabaseService.createUserInteraction(agentContext.userId, {
        agentId: 'proactive',
        question,
        interactionType: 'yes_no',
        priority: this.deriveTaskPriority(task.priority),
        categoryId: task.category_id || null,
        entityId: task.id,
        metadata: {
          actionType: 'schedule_task_focus',
          targetId: task.id,
          taskTitle: task.title,
          taskPriority: task.priority,
          dueDate: task.due_date,
          eventTitle: `Focus: ${task.title}`,
          suggestedStartUtc: startUtc.toISOString(),
          suggestedEndUtc: endUtc.toISOString(),
          suggestedStartLocal: slot.startLocal.toISOString(),
          suggestedEndLocal: slot.endLocal.toISOString(),
          timezone,
          durationMinutes,
          displayTime: readableTime,
          categoryId: task.category_id || null,
          categoryName: task.category_name || task.category || undefined
        },
        expiresAt: addHours(new Date(), 6).toISOString()
      });

      if (interaction) {
        console.log('[TaskFocusStrategy] ✅ Created interaction for task:', task.title, 'ID:', interaction.id);
        existingKeys.add(key);
        created.push({ id: interaction.id, question, metadata: interaction.metadata });
      } else {
        console.log('[TaskFocusStrategy] ❌ Failed to create interaction for task:', task.title);
      }
    }

    console.log('[TaskFocusStrategy] Total interactions created:', created.length);
    return created;
  }

  /**
   * Converts task priority string to numeric priority for interaction sorting.
   */
  private deriveTaskPriority(priority: string | undefined): number {
    if (!priority) return 6;
    const normalized = priority.toLowerCase();
    if (normalized === 'urgent') return 10;
    if (normalized === 'high') return 8;
    if (normalized === 'medium') return 6;
    return 4;
  }
}
