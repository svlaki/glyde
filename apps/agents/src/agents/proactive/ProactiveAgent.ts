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

    console.log('[ProactiveAgent] Generating interactions for user:', context.userId);
    console.log('[ProactiveAgent] Timezone:', timezone);
    console.log('[ProactiveAgent] Manual trigger:', manualTrigger);

    const [events, tasks, goals, existingInteractions] = await Promise.all([
      this.supabaseService.getEvents(context.userId, now.toISOString(), rangeEnd.toISOString()),
      this.supabaseService.getTasks(context.userId), // Fetch all tasks, filter later
      this.supabaseService.getGoals(context.userId, { status: 'active' }),
      this.supabaseService.getPendingUserInteractions(context.userId, this.agentType)
    ]);

    console.log('[ProactiveAgent] Data loaded:', {
      events: events.length,
      tasks: tasks.length,
      goals: goals.length,
      existingInteractions: existingInteractions.length
    });

    // Log task status breakdown
    const tasksByStatus = tasks.reduce((acc: Record<string, number>, t: any) => {
      const status = t.status || 'no_status';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    console.log('[ProactiveAgent] Tasks by status:', tasksByStatus);
    console.log('[ProactiveAgent] Tasks with due dates:', tasks.filter((t: any) => t.due_date).length);

    if (tasks.length > 0) {
      console.log('[ProactiveAgent] Sample tasks:', tasks.slice(0, 5).map((t: any) => ({
        title: t.title,
        due_date: t.due_date,
        status: t.status,
        estimated_duration: t.estimated_duration,
        priority: t.priority
      })));
    }

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

    // Calculate remaining interaction limit dynamically
    const baseLimit = manualTrigger ? 8 : 5;
    let remainingLimit = baseLimit;

    // 1. Event preparation suggestions (high priority)
    const newEventPrepInteractions = await this.createEventPreparationInteractions({
      context,
      timezone,
      events,
      existingKeys,
      limit: Math.min(2, remainingLimit)
    });
    created.push(...newEventPrepInteractions);
    remainingLimit -= newEventPrepInteractions.length;

    // 2. Suggest focus time for urgent or upcoming tasks
    const newTaskInteractions = await this.createTaskFocusInteractions({
      context,
      timezone,
      events,
      tasks,
      existingKeys,
      limit: Math.min(manualTrigger ? 3 : 2, remainingLimit)
    });
    created.push(...newTaskInteractions);
    remainingLimit -= newTaskInteractions.length;

    // 3. Fill significant gaps in schedule with tasks
    const newGapFillInteractions = await this.createEventGapAnalysisInteractions({
      context,
      timezone,
      events,
      tasks,
      existingKeys,
      limit: Math.min(2, remainingLimit)
    });
    created.push(...newGapFillInteractions);
    remainingLimit -= newGapFillInteractions.length;

    // 4. Encourage wellness routines if user has health goals
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

    console.log('[ProactiveAgent] Total interactions created:', created.length, 'breakdown:', {
      eventPrep: newEventPrepInteractions.length,
      taskFocus: newTaskInteractions.length,
      gapFill: newGapFillInteractions.length,
      wellness: newWellnessInteractions.length
    });

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
    console.log('[ProactiveAgent] createTaskFocusInteractions - Total tasks:', tasks.length, 'Limit:', limit);

    if (!tasks || tasks.length === 0 || limit <= 0) {
      console.log('[ProactiveAgent] Skipping task interactions - no tasks or limit reached');
      return [];
    }

    const now = new Date();
    const threeDaysOut = addDays(now, 3);
    const sevenDaysAgo = addDays(now, -7);

    console.log('[ProactiveAgent] Date range for due tasks:', {
      sevenDaysAgo: sevenDaysAgo.toISOString(),
      now: now.toISOString(),
      threeDaysOut: threeDaysOut.toISOString()
    });

    const dueSoonTasks = tasks
      .filter((task: any) => ['pending', 'in_progress'].includes(task.status))
      .filter((task: any) => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        // Include overdue tasks (up to 7 days old) AND upcoming tasks (within next 3 days)
        return dueDate.getTime() >= sevenDaysAgo.getTime() && dueDate.getTime() <= threeDaysOut.getTime();
      })
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    console.log('[ProactiveAgent] Tasks due soon:', dueSoonTasks.length);
    if (dueSoonTasks.length > 0) {
      console.log('[ProactiveAgent] Due soon sample:', dueSoonTasks.slice(0, 3).map((t: any) => ({
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
        console.log('[ProactiveAgent] ✅ Created interaction for task:', task.title, 'ID:', interaction.id);
        existingKeys.add(key);
        created.push({ id: interaction.id, question, metadata: interaction.metadata });
      } else {
        console.log('[ProactiveAgent] ❌ Failed to create interaction for task:', task.title);
      }
    }

    console.log('[ProactiveAgent] Total task interactions created:', created.length);
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

  private async createEventPreparationInteractions(params: {
    context: AgentContext;
    timezone: string;
    events: any[];
    existingKeys: Set<string>;
    limit: number;
  }): Promise<InteractionCreationResult[]> {
    const { context, timezone, events, existingKeys, limit } = params;
    console.log('[ProactiveAgent] createEventPreparationInteractions - Total events:', events.length, 'Limit:', limit);

    if (!events || events.length === 0 || limit <= 0) {
      console.log('[ProactiveAgent] Skipping event preparation - no events or limit reached');
      return [];
    }

    const now = new Date();
    const next48Hours = addDays(now, 2);

    // Event archetypes that typically need preparation
    const prepRequiredKeywords = [
      'meeting', 'interview', 'presentation', 'demo', 'pitch',
      'appointment', 'consultation', 'review', 'call', 'conference'
    ];

    // Find events that need preparation
    const upcomingEvents = events
      .filter((event: any) => {
        const startTime = new Date(event.start_time);
        // Event is in the next 48 hours
        if (startTime < now || startTime > next48Hours) return false;

        // Event should be at least 30 minutes away to give time for prep
        const minutesUntilEvent = (startTime.getTime() - now.getTime()) / (1000 * 60);
        if (minutesUntilEvent < 30) return false;

        // Check if event type needs preparation
        const title = (event.title || '').toLowerCase();
        return prepRequiredKeywords.some(keyword => title.includes(keyword));
      })
      .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    console.log('[ProactiveAgent] Events needing preparation:', upcomingEvents.length);
    if (upcomingEvents.length > 0) {
      console.log('[ProactiveAgent] Prep events sample:', upcomingEvents.slice(0, 3).map((e: any) => ({
        title: e.title,
        start_time: e.start_time
      })));
    }

    const created: InteractionCreationResult[] = [];

    for (const event of upcomingEvents) {
      if (created.length >= limit) break;

      const key = `prepare_event:${event.id}`;
      if (existingKeys.has(key)) {
        continue;
      }

      const eventStartLocal = toZonedTime(new Date(event.start_time), timezone);
      const prepDuration = 30; // 30 minutes prep time

      // Try to find a slot 1-4 hours before the event
      const minutesUntilEvent = (new Date(event.start_time).getTime() - now.getTime()) / (1000 * 60);
      
      // If event is more than 4 hours away, look for prep time 2 hours before
      // If event is closer, look for prep time starting 1 hour before
      const hoursBeforeEvent = minutesUntilEvent > 240 ? 2 : 1;
      const prepWindowStart = addHours(eventStartLocal, -hoursBeforeEvent - 0.5); // Start window
      const prepWindowEnd = addHours(eventStartLocal, -0.5); // End window (30 min buffer before event)

      // Find free slot within this window
      // We need to manually check this time window
      const prepWindowStartMinutes = prepWindowStart.getHours() * 60 + prepWindowStart.getMinutes();
      const prepWindowEndMinutes = prepWindowEnd.getHours() * 60 + prepWindowEnd.getMinutes();

      let slot: TimeSlot | null = null;

      // Try to find slot in the prep window
      const targetDayStart = startOfDay(prepWindowStart);
      const dayEvents = events
        .filter((e: any) => e.id !== event.id) // Exclude the event itself
        .map((e: any) => ({
          start: toZonedTime(new Date(e.start_time), timezone),
          end: toZonedTime(new Date(e.end_time), timezone)
        }))
        .filter(({ start }) => {
          const startDay = startOfDay(start).getTime();
          const targetDay = startOfDay(targetDayStart).getTime();
          return startDay === targetDay;
        })
        .map(({ start, end }) => {
          const startMinutes = start.getHours() * 60 + start.getMinutes();
          const endMinutes = end.getHours() * 60 + end.getMinutes();
          return { start: startMinutes, end: endMinutes };
        })
        .sort((a, b) => a.start - b.start);

      let cursor = Math.max(prepWindowStartMinutes, now.getHours() * 60 + now.getMinutes() + 15);

      for (const interval of dayEvents) {
        if (interval.start >= prepWindowEndMinutes) break; // Past our window
        if (interval.end <= cursor) continue; // Before our cursor

        if (interval.start - cursor >= prepDuration && interval.start <= prepWindowEndMinutes) {
          const slotStart = addMinutes(targetDayStart, cursor);
          const slotEnd = addMinutes(slotStart, prepDuration);
          slot = { startLocal: slotStart, endLocal: slotEnd };
          break;
        }
        cursor = Math.max(cursor, interval.end);
      }

      // Check if we have space at the end of the window
      if (!slot && prepWindowEndMinutes - cursor >= prepDuration) {
        const slotStart = addMinutes(targetDayStart, cursor);
        const slotEnd = addMinutes(slotStart, prepDuration);
        slot = { startLocal: slotStart, endLocal: slotEnd };
      }

      if (!slot) {
        console.log('[ProactiveAgent] No prep slot found for event:', event.title);
        continue;
      }

      const startUtc = fromZonedTime(slot.startLocal, timezone);
      const endUtc = fromZonedTime(slot.endLocal, timezone);

      const eventTime = formatInTimeZone(new Date(event.start_time), timezone, 'EEEE p');
      const prepTime = formatInTimeZone(startUtc, timezone, 'p');

      const question = `You have "${event.title}" at ${eventTime}. Should I block ${prepDuration} minutes at ${prepTime} for preparation?`;

      const interaction = await this.supabaseService.createUserInteraction(context.userId, {
        agentId: this.agentType,
        question,
        interactionType: 'yes_no',
        priority: 8, // High priority - event prep is important
        categoryId: event.category_id || null,
        entityId: event.id,
        metadata: {
          actionType: 'prepare_event',
          targetId: event.id,
          relatedEventTitle: event.title,
          relatedEventStart: event.start_time,
          eventTitle: `Prep: ${event.title}`,
          suggestedStartUtc: startUtc.toISOString(),
          suggestedEndUtc: endUtc.toISOString(),
          suggestedStartLocal: slot.startLocal.toISOString(),
          suggestedEndLocal: slot.endLocal.toISOString(),
          timezone,
          durationMinutes: prepDuration,
          categoryId: event.category_id || null,
          categoryName: event.category_name || event.category || undefined
        },
        expiresAt: addMinutes(startUtc, -15).toISOString() // Expire 15 min before prep time
      });

      if (interaction) {
        console.log('[ProactiveAgent] ✅ Created prep interaction for event:', event.title, 'ID:', interaction.id);
        existingKeys.add(key);
        created.push({ id: interaction.id, question, metadata: interaction.metadata });
      } else {
        console.log('[ProactiveAgent] ❌ Failed to create prep interaction for event:', event.title);
      }
    }

    console.log('[ProactiveAgent] Total event prep interactions created:', created.length);
    return created;
  }

  private async createEventGapAnalysisInteractions(params: {
    context: AgentContext;
    timezone: string;
    events: any[];
    tasks: any[];
    existingKeys: Set<string>;
    limit: number;
  }): Promise<InteractionCreationResult[]> {
    const { context, timezone, events, tasks, existingKeys, limit } = params;
    console.log('[ProactiveAgent] createEventGapAnalysisInteractions - Events:', events.length, 'Tasks:', tasks.length, 'Limit:', limit);

    if (!events || events.length === 0 || !tasks || tasks.length === 0 || limit <= 0) {
      console.log('[ProactiveAgent] Skipping event gap analysis - insufficient data or limit reached');
      return [];
    }

    const now = new Date();
    const endOfToday = addDays(startOfDay(toZonedTime(now, timezone)), 1);
    const endOfTomorrow = addDays(endOfToday, 1);

    // Get events for today and tomorrow
    const relevantEvents = events
      .filter((event: any) => {
        const start = new Date(event.start_time);
        return start >= now && start <= endOfTomorrow;
      })
      .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    if (relevantEvents.length === 0) {
      console.log('[ProactiveAgent] No relevant events for gap analysis');
      return [];
    }

    // Find significant gaps (90+ minutes)
    interface Gap {
      startLocal: Date;
      endLocal: Date;
      durationMinutes: number;
    }

    const gaps: Gap[] = [];
    
    // Check gap from now until first event
    const firstEventStart = toZonedTime(new Date(relevantEvents[0].start_time), timezone);
    const nowLocal = toZonedTime(now, timezone);
    const minutesToFirstEvent = (firstEventStart.getTime() - nowLocal.getTime()) / (1000 * 60);
    
    if (minutesToFirstEvent >= 90) {
      gaps.push({
        startLocal: addMinutes(nowLocal, 15), // Give 15 min buffer
        endLocal: addMinutes(firstEventStart, -15), // End 15 min before event
        durationMinutes: minutesToFirstEvent - 30
      });
    }

    // Check gaps between consecutive events
    for (let i = 0; i < relevantEvents.length - 1; i++) {
      const currentEventEnd = toZonedTime(new Date(relevantEvents[i].end_time), timezone);
      const nextEventStart = toZonedTime(new Date(relevantEvents[i + 1].start_time), timezone);
      const gapMinutes = (nextEventStart.getTime() - currentEventEnd.getTime()) / (1000 * 60);

      if (gapMinutes >= 90) {
        gaps.push({
          startLocal: addMinutes(currentEventEnd, 15), // 15 min buffer after event
          endLocal: addMinutes(nextEventStart, -15), // 15 min buffer before next event
          durationMinutes: gapMinutes - 30
        });
      }
    }

    // Check gap after last event (if before end of day)
    const lastEventEnd = toZonedTime(new Date(relevantEvents[relevantEvents.length - 1].end_time), timezone);
    const lastEventDay = startOfDay(lastEventEnd);
    const endOfLastEventDay = addDays(lastEventDay, 1);
    const lastEventEndMinutes = lastEventEnd.getHours() * 60 + lastEventEnd.getMinutes();
    
    // Only suggest gaps until 8 PM (20:00)
    if (lastEventEndMinutes < 20 * 60) {
      const dayEndTime = addMinutes(lastEventDay, Math.min(20 * 60, endOfLastEventDay.getHours() * 60 + endOfLastEventDay.getMinutes()));
      const gapMinutes = (dayEndTime.getTime() - lastEventEnd.getTime()) / (1000 * 60);
      
      if (gapMinutes >= 90) {
        gaps.push({
          startLocal: addMinutes(lastEventEnd, 15),
          endLocal: dayEndTime,
          durationMinutes: gapMinutes - 15
        });
      }
    }

    console.log('[ProactiveAgent] Found', gaps.length, 'significant gaps (90+ minutes)');

    if (gaps.length === 0) {
      return [];
    }

    // Find tasks that could fit in these gaps
    const availableTasks = tasks
      .filter((task: any) => ['pending', 'in_progress'].includes(task.status))
      .filter((task: any) => {
        // Prefer tasks without due dates (since due date tasks are handled elsewhere)
        // Or tasks with distant due dates
        if (!task.due_date) return true;
        const dueDate = new Date(task.due_date);
        const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntilDue > 3; // Not urgent
      })
      .sort((a: any, b: any) => {
        // Sort by priority
        const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority?.toLowerCase()] || 0;
        const bPriority = priorityOrder[b.priority?.toLowerCase()] || 0;
        return bPriority - aPriority;
      });

    console.log('[ProactiveAgent] Available tasks for gap filling:', availableTasks.length);

    const created: InteractionCreationResult[] = [];

    // Match tasks to gaps
    for (const gap of gaps) {
      if (created.length >= limit) break;

      // Find a task that fits this gap
      const fittingTask = availableTasks.find((task: any) => {
        const key = `fill_gap:${task.id}`;
        if (existingKeys.has(key)) return false;

        const taskDuration = task.estimated_duration || 60;
        return taskDuration <= gap.durationMinutes;
      });

      if (!fittingTask) continue;

      const key = `fill_gap:${fittingTask.id}`;
      const taskDuration = fittingTask.estimated_duration || 60;

      // Schedule at the start of the gap
      const slotStart = gap.startLocal;
      const slotEnd = addMinutes(slotStart, taskDuration);

      const startUtc = fromZonedTime(slotStart, timezone);
      const endUtc = fromZonedTime(slotEnd, timezone);

      const readableTime = formatInTimeZone(startUtc, timezone, 'EEEE p');
      const gapContext = `${Math.floor(gap.durationMinutes / 60)}h${gap.durationMinutes % 60 > 0 ? ` ${gap.durationMinutes % 60}m` : ''} gap`;

      const question = `I found a ${gapContext} in your schedule. Want to work on "${fittingTask.title}" at ${readableTime}? (${taskDuration} min)`;

      const interaction = await this.supabaseService.createUserInteraction(context.userId, {
        agentId: this.agentType,
        question,
        interactionType: 'yes_no',
        priority: this.deriveTaskPriority(fittingTask.priority) - 1, // Slightly lower than urgent task scheduling
        categoryId: fittingTask.category_id || null,
        entityId: fittingTask.id,
        metadata: {
          actionType: 'fill_gap',
          targetId: fittingTask.id,
          taskTitle: fittingTask.title,
          taskPriority: fittingTask.priority,
          eventTitle: `Work: ${fittingTask.title}`,
          suggestedStartUtc: startUtc.toISOString(),
          suggestedEndUtc: endUtc.toISOString(),
          suggestedStartLocal: slotStart.toISOString(),
          suggestedEndLocal: slotEnd.toISOString(),
          timezone,
          durationMinutes: taskDuration,
          gapDurationMinutes: gap.durationMinutes,
          categoryId: fittingTask.category_id || null,
          categoryName: fittingTask.category_name || fittingTask.category || undefined
        },
        expiresAt: addHours(startUtc, -1).toISOString() // Expire 1 hour before suggested time
      });

      if (interaction) {
        console.log('[ProactiveAgent] ✅ Created gap-fill interaction for task:', fittingTask.title, 'ID:', interaction.id);
        existingKeys.add(key);
        created.push({ id: interaction.id, question, metadata: interaction.metadata });
      } else {
        console.log('[ProactiveAgent] ❌ Failed to create gap-fill interaction for task:', fittingTask.title);
      }
    }

    console.log('[ProactiveAgent] Total gap-fill interactions created:', created.length);
    return created;
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
      case 'schedule_goal_activity':
      case 'prepare_event':
      case 'fill_gap': {
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

