import { StateGraph, Annotation } from "@langchain/langgraph";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SupabaseService } from '../../services/SupabaseService.js';
import { SuggestionService } from '../../services/SuggestionService.js';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse } from '../../types/agents.js';
import { getCurrentTimeInTimezone, isValidTimezone } from '../../utils/timezoneUtils.js';
import { formatInTimeZone } from 'date-fns-tz';
import { createPlacementSlotTool } from '../../tools/suggestions/create-placement-slot.js';
import { createActionSuggestionTool } from '../../tools/suggestions/create-action-suggestion.js';
import { listActionSuggestionsTool } from '../../tools/suggestions/list-action-suggestions.js';
import { findFreeTimeTool } from '../../tools/calendar/find-free-time.js';
import { logger as schedulerLogger } from '../../utils/logger.js';
import { buildSchedulerSystemPrompt } from './prompts.js';
import { logger } from '../../utils/logger.js';

const SchedulerState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),
  userId: Annotation<string>(),
  timezone: Annotation<string>(),
});

type SchedulerStateType = typeof SchedulerState.State;

export class SchedulerAgent extends BaseAgent {
  private graph: any;

  constructor() {
    super('scheduler', "gpt-5.4-nano");
    this.graph = this.createGraph();
  }

  getSystemPrompt(): string { return "UNUSED"; }
  getCapabilities(): string[] { return ['scheduling', 'placement']; }

  async initialize(): Promise<void> {
    logger.info('[SCHEDULER] SchedulerAgent initialized');
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    try {
      const supabaseService = new SupabaseService();
      const suggestionService = new SuggestionService();

      const userProfile = await supabaseService.getProfile(context.userId);
      let userTimezone = userProfile?.timezone || context.timezone || 'UTC';
      if (!isValidTimezone(userTimezone)) userTimezone = 'UTC';

      const now = new Date();
      const currentTime = getCurrentTimeInTimezone(userTimezone);

      const [allEvents, userAspects, openSuggestions, activeSlots, userGoals] = await Promise.all([
        supabaseService.getEvents(context.userId),
        supabaseService.getAspects(context.userId),
        suggestionService.listSuggestions(context.userId, { status: 'open' }),
        suggestionService.listSlots(context.userId, {
          start_date: now.toISOString(),
          end_date: new Date(now.getTime() + 7 * 86400000).toISOString(),
        }),
        supabaseService.getGoals(context.userId),
      ]);

      // Fetch tasks, notes, and feedback in parallel
      const client = supabaseService.getClient();
      const [{ data: recentFeedback }, { data: userTasks }, { data: userNotes }, { data: archivedSuggestions }] = await Promise.all([
        client
          .from('slot_feedback')
          .select('feedback_type, reason, created_at')
          .eq('user_id', context.userId)
          .order('created_at', { ascending: false })
          .limit(20),
        client
          .from('tasks')
          .select('title, status, priority, due_date, aspect_id')
          .eq('user_id', context.userId)
          .in('status', ['pending', 'in_progress'])
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(15),
        client
          .from('notes')
          .select('title, aspect_id, updated_at')
          .eq('user_id', context.userId)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(10),
        client
          .from('action_suggestions')
          .select('title')
          .eq('user_id', context.userId)
          .eq('status', 'archived')
          .order('updated_at', { ascending: false })
          .limit(30),
      ]);

      const upcomingEvents = allEvents.filter(e => new Date(e.end_time) >= now);

      const eventContext = upcomingEvents.length > 0
        ? upcomingEvents.slice(0, 15).map((e: any) => {
            const start = formatInTimeZone(new Date(e.start_time), userTimezone, 'EEE MMM d h:mm a');
            const end = formatInTimeZone(new Date(e.end_time), userTimezone, 'h:mm a');
            return `- ${e.title} (${start} - ${end})`;
          }).join('\n')
        : 'No upcoming events';

      // Filter out archived aspects
      const activeAspects = (userAspects || []).filter((a: any) => !a.archived_at);
      const archivedAspectIds = new Set((userAspects || []).filter((a: any) => a.archived_at).map((a: any) => a.id));

      const aspectMap = new Map(activeAspects.map((a: any) => [a.id, a.name]));

      const truncate = (s: string, max: number) => s && s.length > max ? s.slice(0, max) + '...' : s || '';

      const aspectContext = activeAspects.map((a: any) => {
        const desc = a.description ? ` -- ${truncate(a.description, 100)}` : '';
        return `- ${a.name} (${a.color}, id: ${a.id})${desc}`;
      }).join('\n') || 'No aspects';

      const goalsContext = (userGoals || []).length > 0
        ? (userGoals || []).filter((g: any) => g.status === 'active').slice(0, 10).map((g: any) => {
            const aspect = g.aspect_id ? aspectMap.get(g.aspect_id) : g.aspect;
            const deadline = g.target_date ? `, deadline: ${g.target_date}` : '';
            return `- "${g.title}" (aspect: ${aspect || 'none'}${deadline}, progress: ${g.progress || 0}%)`;
          }).join('\n')
        : 'No active goals';

      // Filter out suggestions linked to archived aspects
      const activeSuggestions = openSuggestions.filter(s => !s.aspect_id || !archivedAspectIds.has(s.aspect_id));

      const openSuggestionsContext = activeSuggestions.length > 0
        ? activeSuggestions.map(s => {
            const aspectName = s.aspect_id ? aspectMap.get(s.aspect_id) || 'unknown' : 'none';
            return `- "${s.title}" (type: ${s.suggestion_type}, ${s.estimated_minutes || '?'} min, energy: ${s.energy_level || '?'}, aspect: ${aspectName}, id: ${s.id})`;
          }).join('\n')
        : 'No open suggestions in backlog';

      const tasksContext = (userTasks || []).length > 0
        ? (userTasks || []).map((t: any) => {
            const aspectName = t.aspect_id ? aspectMap.get(t.aspect_id) || '' : '';
            const due = t.due_date ? `, due: ${t.due_date}` : '';
            const pri = t.priority ? `, priority: ${t.priority}` : '';
            return `- "${t.title}" (${t.status}${pri}${due}${aspectName ? `, aspect: ${aspectName}` : ''})`;
          }).join('\n')
        : 'No pending tasks';

      const notesContext = (userNotes || []).length > 0
        ? (userNotes || []).map((n: any) => {
            const aspectName = n.aspect_id ? aspectMap.get(n.aspect_id) || '' : '';
            return `- "${n.title}"${aspectName ? ` (${aspectName})` : ''}`;
          }).join('\n')
        : 'No recent notes';

      const activeSlotsContext = activeSlots.length > 0
        ? activeSlots.map(s => {
            const start = formatInTimeZone(new Date(s.start_time), userTimezone, 'EEE h:mm a');
            return `- "${s.suggestion_title}" at ${start}`;
          }).join('\n')
        : 'No active slots';

      const feedbackContext = (recentFeedback || []).length > 0
        ? (recentFeedback || []).map((f: any) => `- ${f.feedback_type}${f.reason ? `: ${f.reason}` : ''}`).join('\n')
        : 'No recent feedback';

      const dismissedContext = (archivedSuggestions || []).length > 0
        ? (archivedSuggestions || []).map((s: any) => `- "${s.title}"`).join('\n')
        : 'None dismissed yet';

      const systemPrompt = buildSchedulerSystemPrompt({
        timezone: userTimezone,
        currentTime,
        eventContext,
        aspectContext,
        goalsContext,
        tasksContext,
        notesContext,
        openSuggestions: openSuggestionsContext,
        activeSlots: activeSlotsContext,
        recentFeedback: feedbackContext,
        dismissedSuggestions: dismissedContext,
      });

      const result = await this.graph.invoke(
        {
          messages: [systemPrompt, new HumanMessage(message || "Look at my calendar and suggestion backlog. Place the most timely and relevant suggestions into free time slots.")],
          userId: context.userId,
          timezone: userTimezone,
        },
        {
          configurable: {
            userId: context.userId,
            timezone: userTimezone,
          },
          recursionLimit: 20,
        }
      );

      // Track token usage
      this.trackTokenUsage(context.userId, context.sessionId || `scheduler-${Date.now()}`, result.messages);

      const lastMessage = result.messages[result.messages.length - 1];
      const responseText = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

      return {
        content: responseText,
        type: 'text',
      };
    } catch (error) {
      logger.error('[SCHEDULER] Error:', error);
      return {
        content: `Scheduler error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'text',
      };
    }
  }

  private createGraph() {
    const tools = [createPlacementSlotTool, createActionSuggestionTool, listActionSuggestionsTool, findFreeTimeTool];
    const toolNode = new ToolNode(tools);

    const model = this.model.bindTools(tools);

    const callModel = async (state: SchedulerStateType) => {
      const response = await model.invoke(state.messages);
      return { messages: [response] };
    };

    const shouldContinue = (state: SchedulerStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if ('tool_calls' in lastMessage && (lastMessage as any).tool_calls?.length > 0) {
        return "tools";
      }
      return "__end__";
    };

    const graph = new StateGraph(SchedulerState)
      .addNode("agent", callModel)
      .addNode("tools", toolNode as any)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue, { tools: "tools", __end__: "__end__" })
      .addEdge("tools", "agent")
      .compile();

    return graph;
  }
}
