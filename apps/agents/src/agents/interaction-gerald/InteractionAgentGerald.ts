import { StateGraph, Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SupabaseService } from '../../services/SupabaseService.js';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse } from '../../types/agents.js';
import { getCurrentTimeInTimezone } from '../../utils/timezoneUtils.js';
import { toDate, addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ToolRegistry } from '../../tools/ToolRegistry.js';
import { buildGeraldSystemPrompt, GeraldPromptContext } from './prompts.js';

// Define the state structure for Gerald
const GeraldState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),
  userId: Annotation<string>(),
  timezone: Annotation<string>(),
  userEvents: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  userTasks: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  userGoals: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  userProfile: Annotation<any>({
    reducer: (_existing, update) => update || _existing,
    default: () => null,
  }),
  userCategories: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
});

type GeraldStateType = typeof GeraldState.State;

/**
 * InteractionAgentGerald - Enhanced interaction agent with:
 * - Multiple interaction types (yes_no, multiple_choice, text, rating, etc.)
 * - Ability to create tasks, events, and goals
 * - Full context awareness (events, tasks, goals, profile, categories)
 * - Follow-up interaction chaining
 * - Creative, timely suggestions based on time of day
 */
export class InteractionAgentGerald extends BaseAgent {
  private graph: any;

  constructor() {
    // Use 'interaction' as type so it can replace the current interaction agent
    super('interaction', "gpt-5.1"); // Use GPT-5.1 for best reasoning and creativity
    this.graph = this.createGraph();
  }

  async initialize(): Promise<void> {
    // Initialize any required resources
    console.log('🤖 [GERALD] InteractionAgentGerald initialized');
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    try {
      // Load memory context using Zep
      const memoryContext = await this.loadMemoryContext(context, 'conversation');

      const supabaseService = new SupabaseService();

      // Get user profile with timezone
      const userProfile = await supabaseService.getProfile(context.userId);
      const userTimezone = userProfile?.timezone || context.timezone || 'UTC';

      console.log(`🤖 [GERALD] Processing for user ${context.userId} in timezone ${userTimezone}`);

      // Add current message to Zep
      try {
        await this.zepService.addUserMessage(context.userId, message);
      } catch (error) {
        console.warn('[GERALD] Failed to add user message to Zep:', error);
      }

      // Fetch all user context in parallel for efficiency
      const now = new Date();
      const [allEvents, userTasks, userGoals, userCategories] = await Promise.all([
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getCategories(context.userId)
      ]);

      // Filter to future/ongoing events
      const userEvents = allEvents.filter(event => new Date(event.end_time) >= now);

      console.log(`🤖 [GERALD] Context loaded:
        - Events: ${userEvents.length} (filtered from ${allEvents.length})
        - Tasks: ${userTasks?.length || 0}
        - Goals: ${userGoals?.length || 0}
        - Categories: ${userCategories?.length || 0}`);

      // Build conversation history
      const messages: BaseMessage[] = [];

      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const recentHistory = context.conversationHistory.slice(-10);
        for (const msg of recentHistory) {
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          if (msg.role === 'user') {
            messages.push(new HumanMessage(content));
          } else if (msg.role === 'assistant') {
            messages.push(new AIMessage(content));
          }
        }
      }

      messages.push(new HumanMessage(message));

      // Invoke LangGraph with full context
      const result = await this.graph.invoke({
        messages: messages,
        userId: context.userId,
        timezone: userTimezone,
        userEvents: userEvents || [],
        userTasks: userTasks || [],
        userGoals: userGoals || [],
        userProfile: userProfile || null,
        userCategories: userCategories || [],
      }, {
        recursionLimit: 15 // Allow more steps for complex interactions with retries
      });

      console.log('🤖 [GERALD] Graph completed, processing result');

      // Get the last AI message
      const aiMessages = result.messages.filter((m: any) => m._getType() === "ai");
      const lastAiMessage = aiMessages[aiMessages.length - 1];

      let response = lastAiMessage?.content || "Gerald processed your request.";
      console.log('🤖 [GERALD] Final response:', response?.substring?.(0, 100) || response);

      // Add assistant response to Zep
      try {
        await this.zepService.addAssistantMessage(context.userId, response);
      } catch (error) {
        console.warn('[GERALD] Failed to add assistant message to Zep:', error);
      }

      return {
        content: response,
        type: 'text'
      };
    } catch (error) {
      console.error('🤖 [GERALD] Error processing message:', error);
      console.error('🤖 [GERALD] Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('🤖 [GERALD] Error name:', error instanceof Error ? error.name : 'Unknown');
      return {
        content: "Sorry, I encountered an error. Please try again.",
        type: 'text'
      };
    }
  }

  getSystemPrompt(): string {
    return "UNUSED - See buildGeraldSystemPrompt in prompts.ts";
  }

  getCapabilities(): string[] {
    return [
      "Generate varied interaction types (yes_no, multiple_choice, text, rating)",
      "Create tasks, events, and goals",
      "Follow-up interaction chaining",
      "Time-of-day aware suggestions",
      "Full context awareness (profile, events, tasks, goals, categories)",
      "Creative and personalized suggestions",
      "Goal alignment and life balance checks"
    ];
  }

  private createGraph(): any {
    // Get expanded tool set for Gerald
    const toolRegistry = ToolRegistry.getInstance();
    const tools = toolRegistry.getGeraldAgentTools();
    const toolNode = new ToolNode(tools);

    // Bind tools to the model
    const modelWithTools = this.model.bindTools(tools);

    // Register tools with the base agent
    this.registerTools(tools);

    console.log(`🤖 [GERALD] Loaded ${tools.length} tools from ToolRegistry`);

    // Define the workflow nodes
    const callModel = async (state: GeraldStateType) => {
      // Build event context
      const eventContext = this.buildEventContext(state.userEvents, state.timezone);

      // Build task context
      const taskContext = this.buildTaskContext(state.userTasks, state.timezone);

      // Build goal context
      const goalContext = this.buildGoalContext(state.userGoals, state.timezone);

      // Build profile context
      const profileContext = this.buildProfileContext(state.userProfile);

      // Build category context
      const categoryContext = this.buildCategoryContext(state.userCategories);

      // Calculate temporal context
      const nowUtc = new Date();
      const todayFormatted = formatInTimeZone(nowUtc, state.timezone, 'yyyy-MM-dd');
      const tomorrowDayName = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'EEEE');
      const tomorrowFormatted = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'yyyy-MM-dd');
      const currentHour = parseInt(formatInTimeZone(nowUtc, state.timezone, 'H'), 10);

      // Build system prompt with full context
      const promptContext: GeraldPromptContext = {
        timezone: state.timezone,
        eventContext,
        taskContext,
        goalContext,
        profileContext,
        categoryContext,
        todayFormatted,
        tomorrowFormatted,
        tomorrowDayName,
        currentHour,
        toolCount: tools.length,
      };

      const systemMessage = buildGeraldSystemPrompt(promptContext);
      const messages = [systemMessage, ...state.messages];

      console.log(`🤖 [GERALD] Invoking model with ${messages.length} messages`);
      const response = await modelWithTools.invoke(messages);
      console.log(`🤖 [GERALD] Response has ${(response as any).tool_calls?.length || 0} tool calls`);

      return {
        messages: [response],
      };
    };

    const executeTools = async (state: GeraldStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls?.length > 0) {
        const toolCalls = (lastMessage as any).tool_calls;
        console.log(`🤖 [GERALD] Executing ${toolCalls.length} tool calls`);

        // Log each tool call for debugging
        toolCalls.forEach((tc: any, idx: number) => {
          console.log(`🤖 [GERALD] Tool call ${idx + 1}: ${tc.name}`);
          console.log(`🤖 [GERALD] Tool args: ${JSON.stringify(tc.args, null, 2)}`);
        });

        try {
          const toolResults = await toolNode.invoke(state, {
            configurable: {
              userId: state.userId,
              timezone: state.timezone
            }
          });

          console.log(`🤖 [GERALD] Tool results received:`, toolResults?.messages?.length || 0, 'messages');

          // Log each tool result
          if (toolResults?.messages) {
            toolResults.messages.forEach((msg: any, idx: number) => {
              console.log(`🤖 [GERALD] Tool result ${idx + 1}:`, typeof msg.content === 'string' ? msg.content.substring(0, 200) : msg.content);
            });
          }

          return {
            messages: toolResults.messages,
          };
        } catch (toolError) {
          console.error(`🤖 [GERALD] Tool execution error:`, toolError);
          console.error(`🤖 [GERALD] Tool error stack:`, toolError instanceof Error ? toolError.stack : 'No stack');
          throw toolError;
        }
      }
      return {};
    };

    const shouldContinue = (state: GeraldStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls?.length > 0) {
        return "tools";
      }
      return "__end__";
    };

    // Build the graph
    const workflow = new StateGraph(GeraldState)
      .addNode("agent", callModel)
      .addNode("tools", executeTools)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue, {
        tools: "tools",
        "__end__": "__end__"
      })
      .addEdge("tools", "agent");

    return workflow.compile();
  }

  /**
   * Build formatted event context for the prompt
   * Includes category IDs for reference
   */
  private buildEventContext(events: any[], timezone: string): string {
    if (!events || events.length === 0) {
      return `\nCALENDAR: No upcoming events scheduled.`;
    }

    const eventLines = events.slice(0, 15).map((e) => {
      const startDate = toDate(e.start_time);
      const endDate = toDate(e.end_time);
      const dateStr = formatInTimeZone(startDate, timezone, 'EEE, MMM d');
      const startTime = formatInTimeZone(startDate, timezone, 'h:mm a');
      const endTime = formatInTimeZone(endDate, timezone, 'h:mm a');
      const categoryInfo = e.category_name
        ? ` [${e.category_name}${e.category_id ? `, catId: ${e.category_id}` : ''}]`
        : '';
      const location = e.location ? ` @ ${e.location}` : '';
      return `  - "${e.title}" on ${dateStr} from ${startTime} to ${endTime}${categoryInfo}${location}`;
    });

    return `\nCALENDAR (${events.length} upcoming events):\n${eventLines.join('\n')}`;
  }

  /**
   * Build formatted task context for the prompt
   * Includes category IDs so Gerald can assign the correct category when creating events for tasks
   */
  private buildTaskContext(tasks: any[], timezone: string): string {
    if (!tasks || tasks.length === 0) {
      return `\nTASKS: No tasks found.`;
    }

    // Separate by status
    const pending = tasks.filter(t => t.status !== 'completed');
    const completed = tasks.filter(t => t.status === 'completed').slice(0, 3);

    const pendingLines = pending.slice(0, 10).map((t, idx) => {
      const dueStr = t.due_date
        ? ` (Due: ${formatInTimeZone(toDate(t.due_date), timezone, 'MMM d')})`
        : '';
      const priorityStr = t.priority ? ` [${t.priority.toUpperCase()}]` : '';
      const categoryInfo = t.category_name
        ? ` [${t.category_name}${t.category_id ? `, catId: ${t.category_id}` : ''}]`
        : '';
      const desc = t.description ? ` - ${t.description.substring(0, 50)}...` : '';
      return `  ${idx + 1}. ${t.title}${priorityStr}${dueStr}${categoryInfo}${desc}`;
    });

    let taskStr = `\nTASKS (${pending.length} pending):\n${pendingLines.join('\n')}`;

    if (completed.length > 0) {
      taskStr += `\n\nRecently completed: ${completed.map(t => t.title).join(', ')}`;
    }

    return taskStr;
  }

  /**
   * Build formatted goal context for the prompt
   * Includes category IDs so Gerald can assign the correct category when creating events for goals
   */
  private buildGoalContext(goals: any[], timezone: string): string {
    if (!goals || goals.length === 0) {
      return `\nGOALS: No goals set yet.`;
    }

    const activeGoals = goals.filter(g => g.status === 'active');

    const goalLines = activeGoals.slice(0, 8).map((g) => {
      const progress = g.progress != null ? ` (${g.progress}% complete)` : '';
      const targetStr = g.target_date
        ? ` - Target: ${formatInTimeZone(toDate(g.target_date), timezone, 'MMM d, yyyy')}`
        : '';
      const categoryInfo = g.category_name
        ? ` [${g.category_name}${g.category_id ? `, catId: ${g.category_id}` : ''}]`
        : '';
      const desc = g.description ? `\n      ${g.description.substring(0, 100)}` : '';
      return `  - "${g.title}"${progress}${targetStr}${categoryInfo}${desc}`;
    });

    return `\nGOALS (${activeGoals.length} active):\n${goalLines.join('\n')}`;
  }

  /**
   * Build profile context for the prompt
   */
  private buildProfileContext(profile: any): string {
    if (!profile) {
      return `\nPROFILE: Not available.`;
    }

    const parts: string[] = [];

    // Name
    const name = profile.preferred_name || profile.display_name || profile.email?.split('@')[0] || 'User';
    parts.push(`Name: ${name}`);

    // Occupation
    if (profile.occupation) {
      const occ = profile.field_of_study
        ? `${profile.occupation} (${profile.field_of_study})`
        : profile.occupation;
      parts.push(`Occupation: ${occ}`);
    }

    // Habits/Challenges - map IDs to human-readable labels
    if (profile.habits?.length) {
      const habitLabels = this.mapHabitIds(profile.habits);
      parts.push(`Known challenges: ${habitLabels.join(', ')}`);
    }

    // Life aspects
    const aspects = profile.context_data?.life_aspects;
    if (aspects?.length) {
      parts.push(`Life focus areas: ${aspects.join(', ')}`);
    }

    // Goals summary
    if (profile.goals_summary) {
      parts.push(`Goals: ${profile.goals_summary}`);
    }

    return `\nPROFILE:\n  ${parts.join('\n  ')}`;
  }

  /**
   * Map habit IDs to human-readable labels
   */
  private mapHabitIds(habitIds: string[]): string[] {
    const HABIT_LABELS: Record<string, string> = {
      'deadlines': 'struggles with deadlines',
      'task-switching': 'difficulty switching tasks',
      'procrastinator': 'tends to procrastinate',
      'easily-distracted': 'gets easily distracted',
      'poor-time-estimation': 'underestimates task duration',
      'overcommit': 'tends to overcommit',
      'forget-tasks': 'forgets tasks/appointments',
      'work-life-balance': 'work-life balance challenges',
      'perfectionist': 'perfectionist tendencies',
      'energy-management': 'energy management challenges'
    };
    return habitIds.map(id => HABIT_LABELS[id] || id);
  }

  /**
   * Build category context for the prompt
   * Includes category IDs so Gerald can specify them when creating events/tasks/goals
   */
  private buildCategoryContext(categories: any[]): string {
    if (!categories || categories.length === 0) {
      return `\nCATEGORIES: Using defaults (no categoryId needed).`;
    }

    const categoryList = categories.map(c => {
      const desc = c.description ? ` - ${c.description.substring(0, 40)}` : '';
      return `  - "${c.name}" (ID: ${c.id})${desc}`;
    }).join('\n');

    return `\nCATEGORIES (${categories.length}) - Use these IDs when creating events/tasks/goals:\n${categoryList}`;
  }
}
