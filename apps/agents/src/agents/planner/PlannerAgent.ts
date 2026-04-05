import { StateGraph, Annotation } from "@langchain/langgraph";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SupabaseService } from '../../services/SupabaseService.js';
import { SuggestionService } from '../../services/SuggestionService.js';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse } from '../../types/agents.js';
import { getCurrentTimeInTimezone, isValidTimezone } from '../../utils/timezoneUtils.js';
import { formatInTimeZone } from 'date-fns-tz';
import { createActionSuggestionTool } from '../../tools/suggestions/create-action-suggestion.js';
import { listActionSuggestionsTool } from '../../tools/suggestions/list-action-suggestions.js';
import { buildPlannerSystemPrompt } from './prompts.js';
import { logger } from '../../utils/logger.js';

const PlannerState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),
  userId: Annotation<string>(),
  timezone: Annotation<string>(),
});

type PlannerStateType = typeof PlannerState.State;

export class PlannerAgent extends BaseAgent {
  private graph: any;

  constructor() {
    super('planner', "gpt-4.1-mini");
    this.graph = this.createGraph();
  }

  getSystemPrompt(): string { return "UNUSED"; }
  getCapabilities(): string[] { return ['planning', 'suggestions']; }

  async initialize(): Promise<void> {
    logger.info('[PLANNER] PlannerAgent initialized');
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

      const [allEvents, userTasks, userGoals, userAspects, existingSuggestions] = await Promise.all([
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getAspects(context.userId),
        suggestionService.listSuggestions(context.userId, { status: 'open' }),
      ]);

      const upcomingEvents = allEvents.filter(e => new Date(e.end_time) >= now).slice(0, 20);
      const activeTasks = (userTasks || []).filter((t: any) => t.status === 'pending' || t.status === 'in_progress');
      const activeGoals = (userGoals || []).filter((g: any) => g.status === 'active');

      const goalContext = activeGoals.length > 0
        ? activeGoals.map((g: any) => `- ${g.title} (${g.status}, progress: ${g.progress || 0}%)`).join('\n')
        : 'No active goals';

      const taskContext = activeTasks.length > 0
        ? activeTasks.map((t: any) => `- ${t.title} (${t.status}, due: ${t.due_date || 'none'})`).join('\n')
        : 'No active tasks';

      const eventContext = upcomingEvents.length > 0
        ? upcomingEvents.slice(0, 10).map((e: any) => {
            const start = formatInTimeZone(new Date(e.start_time), userTimezone, 'EEE h:mm a');
            return `- ${e.title} (${start})`;
          }).join('\n')
        : 'No upcoming events';

      const aspectContext = (userAspects || []).map((a: any) => `- ${a.name} (${a.color}, id: ${a.id})`).join('\n') || 'No aspects';

      const existingSuggestionsContext = existingSuggestions.length > 0
        ? existingSuggestions.map(s => `- "${s.title}" (${s.suggestion_type})`).join('\n')
        : 'None';

      const systemPrompt = buildPlannerSystemPrompt({
        timezone: userTimezone,
        currentTime,
        goalContext,
        taskContext,
        eventContext,
        aspectContext,
        existingSuggestions: existingSuggestionsContext,
      });

      const result = await this.graph.invoke(
        {
          messages: [systemPrompt, new HumanMessage(message || "Analyze my goals, tasks, and upcoming events. Create actionable suggestions for my backlog.")],
          userId: context.userId,
          timezone: userTimezone,
        },
        {
          configurable: {
            userId: context.userId,
            timezone: userTimezone,
          },
          recursionLimit: 6,
        }
      );

      const lastMessage = result.messages[result.messages.length - 1];
      const responseText = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

      return {
        content: responseText,
        type: 'text',
      };
    } catch (error) {
      logger.error('[PLANNER] Error:', error);
      return {
        content: `Planner error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'text',
      };
    }
  }

  private createGraph() {
    const tools = [createActionSuggestionTool, listActionSuggestionsTool];
    const toolNode = new ToolNode(tools);

    const model = this.model.bindTools(tools);

    const callModel = async (state: PlannerStateType) => {
      const response = await model.invoke(state.messages);
      return { messages: [response] };
    };

    const shouldContinue = (state: PlannerStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if ('tool_calls' in lastMessage && (lastMessage as any).tool_calls?.length > 0) {
        return "tools";
      }
      return "__end__";
    };

    const graph = new StateGraph(PlannerState)
      .addNode("agent", callModel)
      .addNode("tools", toolNode as any)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue, { tools: "tools", __end__: "__end__" })
      .addEdge("tools", "agent")
      .compile();

    return graph;
  }
}
