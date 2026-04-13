import { StateGraph, Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SupabaseService } from '../../services/SupabaseService.js';
import ruleService from '../../services/RuleService.js';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse } from '../../types/agents.js';
import { getCurrentTimeInTimezone, isValidTimezone } from '../../utils/timezoneUtils.js';
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
  userAspects: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  recentInteractions: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  recentPastEvents: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
});

type GeraldStateType = typeof GeraldState.State;

/**
 * InteractionAgentGerald - Enhanced interaction agent with:
 * - Multiple interaction types (yes_no, multiple_choice, text, rating, etc.)
 * - Ability to create tasks, events, and goals
 * - Full context awareness (events, tasks, goals, profile, aspects)
 * - Follow-up interaction chaining
 * - Creative, timely suggestions based on time of day
 */
export class InteractionAgentGerald extends BaseAgent {
  private graph: any;

  constructor() {
    // Use 'interaction' as type so it can replace the current interaction agent
    super('interaction', "gpt-4.1"); // GPT-4.1: strong tool calling + better reasoning than mini
    this.graph = this.createGraph();
  }

  async initialize(): Promise<void> {
    // Initialize any required resources
    console.log('[GERALD] InteractionAgentGerald initialized');
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    try {
      // Load memory context using Zep
      const memoryContext = await this.loadMemoryContext(context, 'conversation');

      const supabaseService = new SupabaseService();

      // Get user profile with timezone
      const userProfile = await supabaseService.getProfile(context.userId);
      let userTimezone = userProfile?.timezone || context.timezone || 'UTC';
      if (!isValidTimezone(userTimezone)) {
        console.warn(`[GERALD] Invalid timezone "${userTimezone}", falling back to UTC`);
        userTimezone = 'UTC';
      }

      console.log(`[GERALD] Processing for user ${context.userId} in timezone ${userTimezone}`);

      // Memory context is loaded via base class loadMemoryContext()

      // Fetch all user context in parallel for efficiency
      const now = new Date();
      const [allEvents, userTasks, userGoals, userAspects] = await Promise.all([
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getAspects(context.userId),
      ]);

      // Filter to future/ongoing events
      const userEvents = allEvents.filter(event => new Date(event.end_time) >= now);

      // Also keep recent past events (last 7 days) for pattern context
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
      const recentPastEvents = allEvents.filter(event =>
        new Date(event.end_time) < now && new Date(event.start_time) >= sevenDaysAgo
      );

      // Filter to only actionable tasks and goals to prevent suggesting actions on completed/cancelled items
      const activeTasks = userTasks?.filter(t => t.status === 'pending' || t.status === 'in_progress') || [];
      const activeGoals = userGoals?.filter(g => g.status === 'active') || [];

      // Fetch recent interactions to avoid repetition
      let recentInteractions: any[] = [];
      try {
        recentInteractions = await supabaseService.getRecentUserInteractions(context.userId, 50, 336);
      } catch (error) {
        console.warn('[GERALD] Failed to fetch recent interactions:', error);
      }

      console.log(`[GERALD] Context loaded:
        - Events: ${userEvents.length} (filtered from ${allEvents.length})
        - Tasks: ${activeTasks.length} active (filtered from ${userTasks?.length || 0})
        - Goals: ${activeGoals.length} active (filtered from ${userGoals?.length || 0})
        - Aspects: ${userAspects?.length || 0}
        - Recent interactions: ${recentInteractions.length}`);

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

      // Invoke LangGraph with filtered context
      const result = await this.graph.invoke({
        messages: messages,
        userId: context.userId,
        timezone: userTimezone,
        userEvents: userEvents || [],
        userTasks: activeTasks,
        userGoals: activeGoals,
        userProfile: userProfile || null,
        userAspects: userAspects || [],
        recentInteractions: recentInteractions || [],
        recentPastEvents: recentPastEvents || [],
      }, {
        recursionLimit: 15 // Allow more steps for complex interactions with retries
      });

      console.log('[GERALD] Graph completed, processing result');

      // Get the last AI message
      const aiMessages = result.messages.filter((m: any) => m._getType() === "ai");
      const lastAiMessage = aiMessages[aiMessages.length - 1];

      let response = lastAiMessage?.content || "Gerald processed your request.";
      console.log('[GERALD] Final response:', response?.substring?.(0, 100) || response);

      // Persist conversation to memory
      try {
        await this.persistConversationToMemory(context, message, response);
      } catch (error) {
        console.warn('[GERALD] Failed to persist conversation to memory:', error);
      }

      return {
        content: response,
        type: 'text'
      };
    } catch (error) {
      console.error('[GERALD] Error processing message:', error);
      console.error('[GERALD] Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('[GERALD] Error name:', error instanceof Error ? error.name : 'Unknown');
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
      "Full context awareness (profile, events, tasks, goals, aspects)",
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

    console.log(`[GERALD] Loaded ${tools.length} tools from ToolRegistry`);

    // Define the workflow nodes
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const callModel = async (state: GeraldStateType) => {
      // Build event context
      const eventContext = this.buildEventContext(state.userEvents, state.timezone);

      // Build task context
      const taskContext = this.buildTaskContext(state.userTasks, state.timezone);

      // Build goal context
      const goalContext = this.buildGoalContext(state.userGoals, state.timezone);

      // Build profile context
      const profileContext = this.buildProfileContext(state.userProfile);

      // Build aspect context
      const aspectContext = this.buildAspectContext(state.userAspects);

      // Calculate temporal context
      const nowUtc = new Date();
      const todayDayName = formatInTimeZone(nowUtc, state.timezone, 'EEEE');
      const todayFormatted = formatInTimeZone(nowUtc, state.timezone, 'yyyy-MM-dd');
      const tomorrowDayName = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'EEEE');
      const tomorrowFormatted = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'yyyy-MM-dd');
      const currentHour = parseInt(formatInTimeZone(nowUtc, state.timezone, 'H'), 10);

      // Load user rules for context injection
      let rulesContext = '';
      try {
        const userRules = await ruleService.getEnabledRules(state.userId);
        if (userRules.length > 0) {
          rulesContext = ruleService.formatRulesForPrompt(userRules);
          console.log(`[GERALD] Loaded ${userRules.length} rules for user context`);
        }
      } catch (error) {
        console.error('[GERALD] Error loading user rules:', error);
      }

      // Build recent interaction context
      const recentInteractionContext = self.buildRecentInteractionContext(state.recentInteractions);

      // Build recent activity context (past 7 days)
      const recentActivityContext = self.buildRecentActivityContext(state.recentPastEvents, state.timezone);

      // Build system prompt with full context
      const promptContext: GeraldPromptContext = {
        timezone: state.timezone,
        eventContext,
        taskContext,
        goalContext,
        profileContext,
        aspectContext,
        todayDayName,
        todayFormatted,
        tomorrowFormatted,
        tomorrowDayName,
        currentHour,
        toolCount: tools.length,
        rulesContext,
        recentInteractionContext,
        recentActivityContext,
      };

      const systemMessage = buildGeraldSystemPrompt(promptContext);
      const messages = [systemMessage, ...state.messages];

      console.log(`[GERALD] Invoking model with ${messages.length} messages`);
      const response = await modelWithTools.invoke(messages);
      console.log(`[GERALD] Response has ${(response as any).tool_calls?.length || 0} tool calls`);

      return {
        messages: [response],
      };
    };

    const executeTools = async (state: GeraldStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls?.length > 0) {
        const toolCalls = (lastMessage as any).tool_calls;
        console.log(`[GERALD] Executing ${toolCalls.length} tool calls`);

        // Log each tool call for debugging
        toolCalls.forEach((tc: any, idx: number) => {
          console.log(`[GERALD] Tool call ${idx + 1}: ${tc.name}`);
          console.log(`[GERALD] Tool args: ${JSON.stringify(tc.args, null, 2)}`);
        });

        try {
          const toolResults = await toolNode.invoke(state, {
            configurable: {
              userId: state.userId,
              timezone: state.timezone
            }
          });

          console.log(`[GERALD] Tool results received:`, toolResults?.messages?.length || 0, 'messages');

          // Log each tool result
          if (toolResults?.messages) {
            toolResults.messages.forEach((msg: any, idx: number) => {
              console.log(`[GERALD] Tool result ${idx + 1}:`, typeof msg.content === 'string' ? msg.content.substring(0, 200) : msg.content);
            });
          }

          return {
            messages: toolResults.messages,
          };
        } catch (toolError) {
          console.error(`[GERALD] Tool execution error:`, toolError);
          console.error(`[GERALD] Tool error stack:`, toolError instanceof Error ? toolError.stack : 'No stack');
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
   * Includes aspect IDs for reference
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
   * Includes aspect IDs so Gerald can assign the correct aspect when creating events for tasks
   */
  private buildTaskContext(tasks: any[], timezone: string): string {
    if (!tasks || tasks.length === 0) {
      return `\nTASKS: No active tasks.`;
    }

    const taskLines = tasks.slice(0, 10).map((t, idx) => {
      const dueStr = t.due_date
        ? ` (Due: ${formatInTimeZone(toDate(t.due_date), timezone, 'MMM d')})`
        : '';
      const priorityStr = t.priority ? ` [${t.priority.toUpperCase()}]` : '';
      const categoryInfo = t.category_name
        ? ` [${t.category_name}${t.category_id ? `, catId: ${t.category_id}` : ''}]`
        : '';
      const statusStr = t.status === 'in_progress' ? ' (in progress)' : '';
      const desc = t.description ? ` - ${t.description.substring(0, 50)}...` : '';
      return `  ${idx + 1}. ${t.title}${priorityStr}${statusStr}${dueStr}${categoryInfo}${desc}`;
    });

    return `\nTASKS (${tasks.length} active):\n${taskLines.join('\n')}`;
  }

  /**
   * Build formatted goal context for the prompt
   * Includes aspect IDs so Gerald can assign the correct aspect when creating events for goals
   */
  private buildGoalContext(goals: any[], timezone: string): string {
    if (!goals || goals.length === 0) {
      return `\nGOALS: No active goals.`;
    }

    const goalLines = goals.slice(0, 8).map((g) => {
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

    return `\nGOALS (${goals.length} active):\n${goalLines.join('\n')}`;
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
   * Build category context for the prompt
   * Includes category IDs so Gerald can specify them when creating events/tasks/goals
   */
  private buildRecentInteractionContext(interactions: any[]): string {
    if (!interactions || interactions.length === 0) {
      return '\nRECENT INTERACTION HISTORY: No recent interactions.';
    }

    const lines = interactions.slice(0, 40).map(i => {
      const status = i.status === 'responded' ? 'responded'
        : i.status === 'dismissed' || i.status === 'expired' || i.status === 'cancelled' ? 'DISMISSED'
        : i.status === 'pending' || i.status === 'active' ? 'still pending'
        : i.status;
      const type = i.interaction_type || 'unknown';
      let age = '';
      if (i.created_at) {
        const ageMin = Math.round((Date.now() - new Date(i.created_at).getTime()) / 60000);
        age = ageMin < 60 ? `${ageMin}min ago` : ageMin < 1440 ? `${Math.round(ageMin / 60)}h ago` : `${Math.round(ageMin / 1440)}d ago`;
      }
      const responseText = i.interaction_responses?.[0]?.response;
      const responseSuffix = responseText ? ` [user answered: "${responseText}"]` : '';
      // Calculate response time if the interaction was responded to
      let responseTimeSuffix = '';
      if (i.status === 'responded' && i.created_at && i.interaction_responses?.[0]?.responded_at) {
        const createdMs = new Date(i.created_at).getTime();
        const respondedMs = new Date(i.interaction_responses[0].responded_at).getTime();
        const diffMin = Math.round((respondedMs - createdMs) / 60000);
        responseTimeSuffix = diffMin < 60
          ? ` [responded in ${diffMin}min]`
          : ` [responded in ${Math.round(diffMin / 60 * 10) / 10}h]`;
      }
      return `  - [${type}] "${i.question}" -> ${status} (${age})${responseSuffix}${responseTimeSuffix}`;
    });

    // Extract dismissed topics for explicit avoidance
    const dismissedTopics = interactions
      .filter(i => ['dismissed', 'expired', 'cancelled'].includes(i.status))
      .map(i => i.question)
      .slice(0, 20);

    const dismissedSection = dismissedTopics.length > 0
      ? `\nDISMISSED TOPICS (NEVER revisit these in any form):\n${dismissedTopics.map(q => `  - "${q}"`).join('\n')}`
      : '';

    return `\nRECENT INTERACTION HISTORY (last ${interactions.length}, newest first):
${lines.join('\n')}
${dismissedSection}
DEDUPLICATION RULES (CRITICAL):
- EVERY question above has ALREADY been asked. Do NOT rephrase or re-ask ANY of them.
- Topics that were DISMISSED must NEVER be brought up again in ANY form.
- If you already asked about exercise, do NOT ask about workouts, gym, fitness, etc.
- If you already asked about studying, do NOT ask about focus time, homework, review, etc.
- If two questions cover the SAME TOPIC even with different wording (e.g. "key challenge" and "biggest concern"), that counts as a repeat. Ask about DIFFERENT subjects entirely.
- Generate COMPLETELY NEW topics not covered above.
- Use DIFFERENT interaction types than the last 3 interactions.
- Vary the CATEGORY (scheduling vs reflection vs check-in vs progress).

LEARN FROM RESPONSE PATTERNS:
- History shows what users ACCEPTED (responded "yes", gave detailed answers) vs DISMISSED (skipped, cancelled, expired).
- If user consistently dismisses scheduling suggestions, ask fewer. Focus on reflections or ratings instead.
- If user responds quickly to ratings, lean into quick-answer formats.
- If user ignores text prompts, prefer multiple-choice or time_suggestion.
- Lean into what the user engages with and away from what they ignore.`;
  }

  /**
   * Build rating context showing tracked scores and trends
   */
  private buildRatingContext(ratingSummary: any[]): string {
    if (!ratingSummary || ratingSummary.length === 0) {
      return '\nRATING TRACKER: No ratings yet. Consider creating rating check-ins for areas the user cares about.';
    }

    const lines = ratingSummary.map(r => {
      const trendIcon = r.trend > 0 ? '(improving)' : r.trend < 0 ? '(declining)' : '(stable)';
      const lastAskedDate = new Date(r.lastAsked);
      const daysSince = Math.round((Date.now() - lastAskedDate.getTime()) / 86400000);
      const timeAgo = daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`;
      return `  - "${r.topic}": ${r.latestScore}/10 ${trendIcon} (last asked: ${timeAgo}, ${r.totalEntries} entries)`;
    });

    return `\nRATING TRACKER (user's self-assessment scores):
${lines.join('\n')}
RATING RULES:
- For ratings that are LOW (1-4): suggest actions to improve that area before re-asking
- For ratings that are HIGH (8-10): acknowledge and focus on maintaining
- For DECLINING ratings: prioritize addressing what's causing the drop
- MINIMUM 5 DAYS between re-asking the same rating topic. Check "last asked" above - if less than 5 days ago, DO NOT ask about that topic in ANY form
- When asking a rating, ask about the past 5 days (e.g., "How would you rate X over the past 5 days?")
- When creating a rating interaction, include metadata.ratingTopic with the EXACT same topic name used before
- Use interaction type "rating" with options ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
- NEVER create multiple rating interactions about the same topic or related topics in one batch`;
  }

  /**
   * Build aspect context for the prompt
   * Includes aspect IDs so Gerald can specify them when creating events/tasks/goals
   */
  private buildAspectContext(aspects: any[]): string {
    if (!aspects || aspects.length === 0) {
      return `\nASPECTS: Using defaults (no aspectId needed).`;
    }

    const aspectList = aspects.map(a => {
      const desc = a.description ? ` - ${a.description.substring(0, 40)}` : '';
      return `  - "${a.name}" (ID: ${a.id})${desc}`;
    }).join('\n');

    return `\nASPECTS (${aspects.length}) - Use these IDs when creating events/tasks/goals:\n${aspectList}`;
  }

  /**
   * Build recent activity context from past 7 days of events.
   * This gives Gerald pattern data about user's actual habits and routines.
   */
  private buildRecentActivityContext(pastEvents: any[], timezone: string): string {
    if (!pastEvents || pastEvents.length === 0) {
      return '';
    }

    const sorted = [...pastEvents].sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );

    const eventLines = sorted.slice(0, 20).map((e) => {
      const startDate = toDate(e.start_time);
      const dateStr = formatInTimeZone(startDate, timezone, 'EEE, MMM d');
      const startTime = formatInTimeZone(startDate, timezone, 'h:mm a');
      const categoryInfo = e.category_name ? ` [${e.category_name}]` : '';
      return `  - "${e.title}" on ${dateStr} at ${startTime}${categoryInfo}`;
    });

    return `\nRECENT ACTIVITY (past 7 days - use to understand user's patterns and habits):
${eventLines.join('\n')}
Use this to suggest interactions that fit the user's actual routine and lifestyle patterns.`;
  }
}
