import { addDays, addHours, addMinutes, startOfDay } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse } from '../../types/agents.js';
import { AgentRegistry } from '../AgentRegistry.js';

type ProactiveCommand =
  | { command: 'generate_interactions'; manual?: boolean }
  | { command: 'handle_response'; interactionId: string; response: string; interaction?: any };

interface TimeSlot {
  startLocal: Date;
  endLocal: Date;
}

interface InteractionCreationResult {
  id?: string;
  question: string;
  metadata?: Record<string, any> | null;
}

export class ProactiveAgent extends BaseAgent {
  constructor() {
    super('proactive', 'gpt-4o-mini');
  }

  async initialize(): Promise<void> {
    // No-op for now – future initialization hooks (e.g., caching) can live here
  }

  getSystemPrompt(): string {
    return 'You are Glyde\'s proactive intelligence agent. Your job is to scan the user\'s calendar, tasks, and goals, then create actionable interaction cards that help them plan their time effectively.';
  }

  getCapabilities(): string[] {
    return [
      'Analyze calendar availability to find productive focus blocks',
      'Recommend scheduling time for high-priority tasks',
      'Promote healthy goal-aligned routines like exercise',
      'Respond to interaction confirmations by creating events automatically'
    ];
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    const payload = this.parseMessage(message);

    if (!payload) {
      return {
        type: 'text',
        content: 'Proactive agent received an unsupported request.'
      };
    }

    switch (payload.command) {
      case 'generate_interactions': {
        const result = await this.generateInteractions(context, payload.manual ?? false);
        return {
          type: 'analysis',
          content: result.summary,
          data: result.details
        };
      }

      case 'handle_response': {
        const result = await this.handleInteractionResponse(context, payload);
        return {
          type: 'action',
          content: result.message,
          data: result.details
        };
      }

      default:
        return {
          type: 'text',
          content: 'Proactive agent is ready.'
        };
    }
  }

  private parseMessage(message: string): ProactiveCommand | null {
    if (!message) return null;

    if (typeof message === 'string') {
      try {
        const parsed = JSON.parse(message);
        if (parsed && typeof parsed.command === 'string') {
          return parsed as ProactiveCommand;
        }
      } catch (error) {
        // Not JSON – treat raw string as command keyword
        return { command: message.trim() as ProactiveCommand['command'] } as ProactiveCommand;
      }
    }

    return null;
  }

  private async generateInteractions(context: AgentContext, manualTrigger: boolean): Promise<{
    summary: string;
    details: InteractionCreationResult[];
  }> {
    const { timezone } = await this.resolveTimezone(context);
    const now = new Date();
    const rangeEnd = addDays(now, 2);

    const [events, tasks, goals, existingInteractions] = await Promise.all([
      this.supabaseService.getEvents(context.userId, now.toISOString(), rangeEnd.toISOString()),
      this.supabaseService.getTasks(context.userId, { status: 'pending' }),
      this.supabaseService.getGoals(context.userId, { status: 'active' }),
      this.supabaseService.getPendingUserInteractions(context.userId, this.agentType)
    ]);

    const created: InteractionCreationResult[] = [];
    const existingKeys = new Set(
      existingInteractions
        .map((interaction: any) => {
          const metadata = interaction.metadata || {};
          if (metadata.actionType && metadata.targetId) {
            return `${metadata.actionType}:${metadata.targetId}`;
          }
          return null;
        })
        .filter(Boolean) as string[]
    );

    // 1. Suggest focus time for urgent or upcoming tasks
    const newTaskInteractions = await this.createTaskFocusInteractions({
      context,
      timezone,
      events,
      tasks,
      existingKeys,
      limit: manualTrigger ? 3 : 2
    });
    created.push(...newTaskInteractions);

    // 2. Encourage wellness routines if user has health goals
    const newWellnessInteractions = await this.createWellnessInteractions({
      context,
      timezone,
      events,
      goals,
      existingKeys
    });
    created.push(...newWellnessInteractions);

    const summary = created.length === 0
      ? manualTrigger
        ? 'No new proactive suggestions were needed – everything looks balanced.'
        : 'No new proactive interactions created this cycle.'
      : `Created ${created.length} proactive interaction${created.length === 1 ? '' : 's'} to help the user plan their time.`;

    return { summary, details: created };
  }

  private async createTaskFocusInteractions(params: {
    context: AgentContext;
    timezone: string;
    events: any[];
    tasks: any[];
    existingKeys: Set<string>;
    limit: number;
  }): Promise<InteractionCreationResult[]> {
    const { context, timezone, events, tasks, existingKeys, limit } = params;
    if (!tasks || tasks.length === 0 || limit <= 0) {
      return [];
    }

    const now = new Date();
    const threeDaysOut = addDays(now, 3);

    const dueSoonTasks = tasks
      .filter((task: any) => ['pending', 'in_progress'].includes(task.status))
      .filter((task: any) => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate.getTime() >= now.getTime() && dueDate.getTime() <= threeDaysOut.getTime();
      })
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const created: InteractionCreationResult[] = [];

    for (const task of dueSoonTasks) {
      if (created.length >= limit) break;

      const key = `schedule_task_focus:${task.id}`;
      if (existingKeys.has(key)) {
        continue;
      }

      const durationMinutes = task.estimated_duration || 60;
      let slot: TimeSlot | null = null;

      // Try to find time today first, then tomorrow
      slot = this.findFreeSlot(events, timezone, { dayOffset: 0, durationMinutes });
      if (!slot) {
        slot = this.findFreeSlot(events, timezone, { dayOffset: 1, durationMinutes });
      }

      if (!slot) {
        continue;
      }

      const startUtc = fromZonedTime(slot.startLocal, timezone);
      const endUtc = fromZonedTime(slot.endLocal, timezone);

      const isTomorrow = startUtc.getDate() !== now.getDate();
      const readableTime = formatInTimeZone(startUtc, timezone, 'EEEE p');
      const dueLabel = formatInTimeZone(fromZonedTime(new Date(task.due_date), timezone), timezone, 'EEEE, MMM d');

      const question = `"${task.title}" is due ${dueLabel}. I found a ${durationMinutes}-minute focus block ${isTomorrow ? 'tomorrow' : 'today'} at ${formatInTimeZone(startUtc, timezone, 'p')}. Should I schedule it?`;

      const interaction = await this.supabaseService.createUserInteraction(context.userId, {
        agentId: this.agentType,
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
        existingKeys.add(key);
        created.push({ id: interaction.id, question, metadata: interaction.metadata });
      }
    }

    return created;
  }

  private async createWellnessInteractions(params: {
    context: AgentContext;
    timezone: string;
    events: any[];
    goals: any[];
    existingKeys: Set<string>;
  }): Promise<InteractionCreationResult[]> {
    const { context, timezone, events, goals, existingKeys } = params;

    if (!goals || goals.length === 0) {
      return [];
    }

    const healthGoal = goals.find((goal: any) => {
      const category = (goal.category_name || goal.category || '').toLowerCase();
      const title = (goal.title || '').toLowerCase();
      return category.includes('health') || category.includes('fitness') || title.includes('exercise') || title.includes('fitness') || title.includes('run') || title.includes('gym');
    });

    if (!healthGoal) {
      return [];
    }

    const key = `schedule_goal_activity:${healthGoal.id}`;
    if (existingKeys.has(key)) {
      return [];
    }

    const hasExercisePlanned = events.some((event: any) => {
      const title = (event.title || '').toLowerCase();
      return title.match(/gym|workout|exercise|run|yoga|walk|fitness|training/);
    });

    if (hasExercisePlanned) {
      return [];
    }

    let slot = this.findFreeSlot(events, timezone, {
      dayOffset: 0,
      durationMinutes: 45,
      earliestMinutes: 16 * 60,
      latestMinutes: 21 * 60
    });

    if (!slot) {
      slot = this.findFreeSlot(events, timezone, {
        dayOffset: 1,
        durationMinutes: 45,
        earliestMinutes: 7 * 60,
        latestMinutes: 21 * 60
      });
    }

    if (!slot) {
      return [];
    }

      const startUtc = fromZonedTime(slot.startLocal, timezone);
      const endUtc = fromZonedTime(slot.endLocal, timezone);

    const readableTime = formatInTimeZone(startUtc, timezone, 'EEEE p');
    const question = `You mentioned a fitness goal. How about a 45-minute workout ${formatInTimeZone(startUtc, timezone, "'on' EEEE 'at' p")}?`;

    const interaction = await this.supabaseService.createUserInteraction(context.userId, {
      agentId: this.agentType,
      question,
      interactionType: 'yes_no',
      priority: 7,
      categoryId: healthGoal.category_id || null,
      entityId: healthGoal.id,
      metadata: {
        actionType: 'schedule_goal_activity',
        targetId: healthGoal.id,
        goalTitle: healthGoal.title,
        eventTitle: 'Fitness Session',
        suggestedStartUtc: startUtc.toISOString(),
        suggestedEndUtc: endUtc.toISOString(),
        suggestedStartLocal: slot.startLocal.toISOString(),
        suggestedEndLocal: slot.endLocal.toISOString(),
        timezone,
        durationMinutes: 45,
        displayTime: readableTime,
        categoryId: healthGoal.category_id || null,
        categoryName: healthGoal.category_name || healthGoal.category || 'Fitness'
      },
      expiresAt: addHours(new Date(), 8).toISOString()
    });

    if (interaction) {
      existingKeys.add(key);
      return [{ id: interaction.id, question, metadata: interaction.metadata }];
    }

    return [];
  }

  private deriveTaskPriority(priority: string | undefined): number {
    if (!priority) return 6;
    const normalized = priority.toLowerCase();
    if (normalized === 'urgent') return 10;
    if (normalized === 'high') return 8;
    if (normalized === 'medium') return 6;
    return 4;
  }

  private findFreeSlot(
    events: any[],
    timezone: string,
    options: { dayOffset: number; durationMinutes: number; earliestMinutes?: number; latestMinutes?: number }
  ): TimeSlot | null {
    const { dayOffset, durationMinutes } = options;
    const earliestMinutes = options.earliestMinutes ?? 9 * 60;
    const latestMinutes = options.latestMinutes ?? 19 * 60;

    const nowInZone = toZonedTime(new Date(), timezone);
    const targetDayStart = addDays(startOfDay(nowInZone), dayOffset);

    const nowMinutes = nowInZone.getHours() * 60 + nowInZone.getMinutes();
    let cursor = dayOffset === 0 ? Math.max(earliestMinutes, nowMinutes + 15) : earliestMinutes;

    const dayEvents = events
      .map((event: any) => ({
        start: toZonedTime(new Date(event.start_time), timezone),
        end: toZonedTime(new Date(event.end_time), timezone)
      }))
      .filter(({ start, end }) => {
        const startDay = startOfDay(start).getTime();
        const targetDay = startOfDay(targetDayStart).getTime();
        const endDay = startOfDay(end).getTime();
        return startDay === targetDay || endDay === targetDay;
      })
      .map(({ start, end }) => {
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        return {
          start: Math.max(startMinutes, earliestMinutes),
          end: Math.min(endMinutes, latestMinutes)
        };
      })
      .filter(({ start, end }) => end > start)
      .sort((a, b) => a.start - b.start);

    for (const interval of dayEvents) {
      if (interval.start - cursor >= durationMinutes) {
        const slotStart = addMinutes(targetDayStart, cursor);
        const slotEnd = addMinutes(slotStart, durationMinutes);
        return { startLocal: slotStart, endLocal: slotEnd };
      }
      cursor = Math.max(cursor, interval.end);
    }

    if (latestMinutes - cursor >= durationMinutes) {
      const slotStart = addMinutes(targetDayStart, cursor);
      const slotEnd = addMinutes(slotStart, durationMinutes);
      return { startLocal: slotStart, endLocal: slotEnd };
    }

    return null;
  }

  private async handleInteractionResponse(context: AgentContext, payload: { interactionId: string; response: string; interaction?: any }): Promise<{
    message: string;
    details?: Record<string, any>;
  }> {
    const response = payload.response?.toLowerCase?.() || '';

    const interaction = payload.interaction ?? (await this.supabaseService.getUserInteractionById(payload.interactionId));

    if (!interaction) {
      return { message: 'Unable to process response – interaction was not found.' };
    }

    const metadata = interaction.metadata || {};
    const actionType = metadata.actionType as string | undefined;

    if (!actionType) {
      return { message: 'No follow-up action defined for this interaction.' };
    }

    if (['no', 'skip', 'dismiss'].includes(response)) {
      return { message: 'Understood – no action taken.', details: { actionType, outcome: 'declined' } };
    }

    const timezone = metadata.timezone || context.timezone || 'UTC';

    switch (actionType) {
      case 'schedule_task_focus':
      case 'schedule_goal_activity': {
        const eventResult = await this.scheduleEventFromMetadata(context, interaction, metadata, response, timezone);
        return eventResult;
      }

      default:
        return { message: 'Interaction acknowledged but no handler was available.' };
    }
  }

  private async scheduleEventFromMetadata(
    context: AgentContext,
    interaction: any,
    metadata: Record<string, any>,
    response: string,
    timezone: string
  ): Promise<{ message: string; details?: Record<string, any> }> {
    const startUtc = metadata.suggestedStartUtc;
    const endUtc = metadata.suggestedEndUtc;

    if (!startUtc || !endUtc) {
      return { message: 'I could not schedule that event – the suggested time was missing.' };
    }

    const eventTitle = response && response.length > 0 && !['yes', 'confirm'].includes(response.toLowerCase())
      ? response
      : metadata.eventTitle || metadata.taskTitle || metadata.goalTitle || 'Scheduled Focus';

    const event = await this.supabaseService.createEvent(context.userId, {
      title: eventTitle,
      start_time: startUtc,
      end_time: endUtc,
      description: metadata.goalTitle
        ? `Progress toward "${metadata.goalTitle}"`
        : metadata.taskTitle
          ? `Focus time reserved for "${metadata.taskTitle}"`
          : metadata.description || '',
      category_id: metadata.categoryId || null,
      category: metadata.categoryName || undefined
    });

    if (event) {
      await this.persistCalendarEventToMemory(
        context.userId,
        event.title,
        event.description || null,
        new Date(event.start_time),
        new Date(event.end_time),
        undefined,
        undefined,
        undefined,
        metadata.categoryName || undefined
      );

      if (metadata.taskTitle && metadata.targetId) {
        try {
          await this.supabaseService.updateTask(context.userId, metadata.targetId, {
            status: 'in_progress'
          });
        } catch (error) {
          console.warn('⚠️ [PROACTIVE AGENT] Unable to update task status:', error);
        }
      }

      return {
        message: `Scheduled "${event.title}" for ${formatInTimeZone(new Date(event.start_time), timezone, "EEEE 'at' p")}.`,
        details: {
          action: 'event_created',
          interactionId: interaction.id,
          eventId: event.id,
          start: event.start_time,
          end: event.end_time
        }
      };
    }

    return {
      message: 'I attempted to schedule that, but something went wrong.',
      details: {
        action: 'event_failed',
        interactionId: interaction.id
      }
    };
  }

  private async resolveTimezone(context: AgentContext): Promise<{ timezone: string }> {
    if (context.userProfile?.timezone) {
      return { timezone: context.userProfile.timezone };
    }

    if (context.timezone) {
      return { timezone: context.timezone };
    }

    const profile = await this.supabaseService.getProfile(context.userId);
    return { timezone: profile?.timezone || 'UTC' };
  }
}

let proactiveInitializationPromise: Promise<void> | null = null;

export async function ensureProactiveAgent(agentRegistry: AgentRegistry): Promise<void> {
  if (agentRegistry.hasAgent('proactive')) {
    return;
  }

  if (!proactiveInitializationPromise) {
    proactiveInitializationPromise = (async () => {
      const agent = new ProactiveAgent();
      await agentRegistry.registerAgent(agent);
    })()
      .catch(error => {
        console.error('❌ Failed to initialize proactive agent:', error);
        throw error;
      })
      .finally(() => {
        proactiveInitializationPromise = null;
      });
  }

  await proactiveInitializationPromise;
}

