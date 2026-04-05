import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse } from '../../types/agents.js';
import { SupabaseService } from '../../services/SupabaseService.js';
import { ToolRegistry } from '../../tools/ToolRegistry.js';
import { isValidTimezone } from '../../utils/timezoneUtils.js';
import { buildScribeSystemPrompt } from './prompts.js';
import type { ScribePromptContext } from './prompts.js';

/**
 * ScribeAgent - Silent knowledge observer
 *
 * Creates notes that enrich the knowledge graph without direct user interaction.
 * Runs on schedule (daily digest, weekly pattern scan, weekly connection finder)
 * and on-demand for research tasks delegated from the conversation agent.
 *
 * Notes created by Scribe have source='scribe' and status='scribe',
 * making them visible in the graph and backlinks but not the notes dropdown.
 */
export class ScribeAgent extends BaseAgent {
  constructor() {
    super('scribe', 'gpt-4.1-mini');
  }

  async initialize(): Promise<void> {
    const registry = ToolRegistry.getInstance();
    // Scribe needs: notes tools, profile tools, memory search, search tools
    const scribeToolNames = [
      'get_notes', 'create_notes', 'update_notes',
      'get_profile',
      'search_memory_unified',
      'web_search', 'location_search',
    ];

    const allTools = registry.getAllTools();
    const scribeTools = allTools.filter((t: any) => {
      const name = t.name || t.schema?.name;
      return scribeToolNames.includes(name);
    });

    this.registerTools(scribeTools);
    console.log(`[SCRIBE] ScribeAgent initialized with ${scribeTools.length} tools`);
  }

  getSystemPrompt(): string {
    return 'You are Scribe, a silent knowledge observer for Glyde.';
  }

  getCapabilities(): string[] {
    return [
      'Create daily digest notes summarizing user activity',
      'Detect behavioral patterns from user data',
      'Discover connections between life areas',
      'Research topics and create reference notes',
    ];
  }

  /**
   * Main entry point -- mode is determined by the message prefix.
   * Modes: DAILY_DIGEST, PATTERN_SCAN, CONNECTION_SCAN, RESEARCH:<topic>
   */
  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    try {
      const supabaseService = new SupabaseService();
      const userProfile = await supabaseService.getProfile(context.userId);
      let timezone = userProfile?.timezone || context.timezone || 'UTC';
      if (!isValidTimezone(timezone)) {
        timezone = 'UTC';
      }

      const userName = userProfile?.display_name || userProfile?.email?.split('@')[0] || 'User';
      const aspects = await supabaseService.getAspects(context.userId);
      const aspectContext = aspects.map((a: any) =>
        `- ${a.name} (id: ${a.id}, color: ${a.color})`
      ).join('\n');

      // Determine mode from message
      let mode: ScribePromptContext['mode'] = 'daily-digest';
      let researchTopic: string | undefined;

      if (message.startsWith('PATTERN_SCAN')) {
        mode = 'pattern-scan';
      } else if (message.startsWith('CONNECTION_SCAN')) {
        mode = 'connection-finder';
      } else if (message.startsWith('RESEARCH:')) {
        mode = 'research';
        researchTopic = message.replace('RESEARCH:', '').trim();
      }

      // Build context data
      const now = new Date();
      const todayFormatted = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: timezone,
      });

      const contextData = await this.buildContextData(
        supabaseService, context.userId, timezone, mode
      );

      const promptContext: ScribePromptContext = {
        timezone,
        todayFormatted,
        userName,
        aspectContext,
        mode,
        researchTopic,
        ...contextData,
      };

      const systemPrompt = buildScribeSystemPrompt(promptContext);
      const messages: BaseMessage[] = [systemPrompt, new HumanMessage(message)];

      // Invoke with tools -- Scribe uses tools to create notes
      const modelWithTools = this.model.bindTools(this.tools);

      // Allow up to 3 rounds of tool calling (e.g., search then create)
      let response = await modelWithTools.invoke(messages);
      let rounds = 0;
      const maxRounds = 4;

      while (response.tool_calls && response.tool_calls.length > 0 && rounds < maxRounds) {
        rounds++;
        messages.push(new AIMessage(response));

        for (const toolCall of response.tool_calls) {
          const tool = this.tools.find((t: any) =>
            (t.name || t.schema?.name) === toolCall.name
          );

          if (tool) {
            try {
              const result = await tool.invoke(toolCall.args, {
                configurable: { userId: context.userId },
              });
              const { ToolMessage } = await import('@langchain/core/messages');
              messages.push(new ToolMessage({
                tool_call_id: toolCall.id || '',
                content: typeof result === 'string' ? result : JSON.stringify(result),
              }));
            } catch (toolError: any) {
              console.error(`[SCRIBE] Tool ${toolCall.name} failed:`, toolError.message);
              const { ToolMessage } = await import('@langchain/core/messages');
              messages.push(new ToolMessage({
                tool_call_id: toolCall.id || '',
                content: `Error: ${toolError.message}`,
              }));
            }
          }
        }

        response = await modelWithTools.invoke(messages);
      }

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      console.log(`[SCRIBE] Completed ${mode} for user ${context.userId} in ${rounds} tool rounds`);

      return {
        content,
        type: 'text',
      };
    } catch (error: any) {
      console.error(`[SCRIBE] Error processing ${message}:`, error.message);
      return {
        content: `Scribe encountered an error: ${error.message}`,
        type: 'text',
      };
    }
  }

  /**
   * Build context data for the prompt based on mode.
   */
  private async buildContextData(
    supabase: SupabaseService,
    userId: string,
    timezone: string,
    mode: ScribePromptContext['mode']
  ): Promise<Partial<ScribePromptContext>> {
    const notes = await supabase.getAllNotes(userId);
    const existingNotes = notes
      .filter((n: any) => n.status !== 'archived')
      .slice(0, 40)
      .map((n: any) => `- [[${n.title}]] (${n.aspect_name || 'no aspect'})`)
      .join('\n');

    if (mode === 'connection-finder') {
      const goals = await supabase.getGoals(userId);
      const dayGoals = goals.slice(0, 20).map((g: any) =>
        `- ${g.title} (${g.status}, aspect: ${g.aspect || g.category || 'none'})`
      ).join('\n');

      return { existingNotes, dayGoals };
    }

    // For daily-digest and pattern-scan, load events, tasks, and goals
    // Use timezone-aware date bounds
    // Extend end by 8 hours to catch events that start today but end after midnight
    const nowInTz = new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
    const todayStartISO = new Date(`${nowInTz}T00:00:00`).toISOString();
    const todayEndDate = new Date(`${nowInTz}T23:59:59`);
    todayEndDate.setHours(todayEndDate.getHours() + 8);
    const todayEndISO = todayEndDate.toISOString();

    // Only fetch today's events for digest (avoid loading thousands of expanded recurring events)
    const tasks = await supabase.getTasks(userId);
    const goals = await supabase.getGoals(userId);

    if (mode === 'daily-digest') {
      // Fetch only today's events via RPC with date range
      const { data: todayEventsRaw } = await supabase.getClient()
        .rpc('get_events_with_aspects', {
          p_user_id: userId,
          p_start_date: todayStartISO,
          p_end_date: todayEndISO,
        });
      // Filter to events that START today (the wider end window is just to avoid RPC exclusions)
      const todayStartDate = new Date(todayStartISO);
      const todayMidnight = new Date(`${nowInTz}T23:59:59`);
      const todayEvents = (todayEventsRaw || []).filter((e: any) => {
        const start = new Date(e.start_time);
        return start >= todayStartDate && start <= todayMidnight;
      });

      const todayStart = todayStartDate;

      const dayEvents = todayEvents.length > 0
        ? todayEvents.slice(0, 20).map((e: any) => {
            const time = new Date(e.start_time).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: timezone,
            });
            const shared = e.is_shared ? ' [shared]' : '';
            return `- ${time}: ${e.title} (${e.aspect_name || e.category || 'uncategorized'})${e.location ? ` @ ${e.location}` : ''}${shared}`;
          }).join('\n')
        : '';

      // Fetch friend/shared events for today
      let friendEvents = '';
      try {
        const { data: friendEventsData } = await supabase.getClient()
          .rpc('get_friends_events', {
            p_user_id: userId,
            p_start_date: todayStart.toISOString(),
            p_end_date: todayEndISO,
          });
        if (friendEventsData && friendEventsData.length > 0) {
          friendEvents = friendEventsData.slice(0, 10).map((e: any) => {
            const time = new Date(e.start_time).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: timezone,
            });
            return `- ${time}: ${e.title} (${e.aspect_name || 'shared'}, from ${e.owner_display_name || 'friend'})${e.location ? ` @ ${e.location}` : ''}`;
          }).join('\n');
        }
      } catch {
        // Friend events may not be available
      }

      const recentTasks = tasks.filter((t: any) => {
        const updated = new Date(t.updated_at);
        return updated >= todayStart;
      });

      const dayTasks = recentTasks.length > 0
        ? recentTasks.slice(0, 15).map((t: any) =>
            `- [${t.status === 'completed' ? 'x' : ' '}] ${t.title} (${t.priority || 'normal'} priority, ${t.aspect || t.category || 'uncategorized'})`
          ).join('\n')
        : '';

      // Goals: show title and status only, no progress percentages
      const activeGoals = goals.filter((g: any) => g.status === 'active');
      const dayGoals = activeGoals.length > 0
        ? activeGoals.slice(0, 10).map((g: any) =>
            `- ${g.title} (${g.aspect || g.category || 'uncategorized'})`
          ).join('\n')
        : '';

      // Get today's chat messages for summary
      let dayChatSummary = '';
      try {
        const { data: chatMessages } = await supabase.getClient()
          .from('chat_messages')
          .select('content, sender, created_at')
          .eq('user_id', userId)
          .gte('created_at', todayStart.toISOString())
          .order('created_at', { ascending: true })
          .limit(30);

        if (chatMessages && chatMessages.length > 0) {
          const topics = chatMessages
            .filter((m: any) => m.sender === 'user')
            .slice(0, 10)
            .map((m: any) => m.content?.slice(0, 100))
            .filter(Boolean);
          if (topics.length > 0) {
            dayChatSummary = `User discussed ${topics.length} topics including: ${topics.slice(0, 5).join('; ')}`;
          }
        }
      } catch {
        // Chat messages may not be available
      }

      return { dayEvents, friendEvents, dayTasks, dayGoals, dayChatSummary, existingNotes };
    }

    if (mode === 'pattern-scan') {
      // Last 14 days of data for pattern detection
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const { data: recentEventsRaw } = await supabase.getClient()
        .rpc('get_events_with_aspects', {
          p_user_id: userId,
          p_start_date: twoWeeksAgo.toISOString(),
          p_end_date: new Date().toISOString(),
        });
      const recentEvents = recentEventsRaw || [];

      const dayEvents = recentEvents.slice(0, 40).map((e: any) => {
        const day = new Date(e.start_time).toLocaleDateString('en-US', {
          weekday: 'short',
          timeZone: timezone,
        });
        const time = new Date(e.start_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: timezone,
        });
        return `- ${day} ${time}: ${e.title} (${e.aspect_name || e.category || 'uncategorized'})`;
      }).join('\n');

      const recentTasks = tasks.filter((t: any) =>
        new Date(t.updated_at) >= twoWeeksAgo
      );
      const dayTasks = recentTasks.slice(0, 30).map((t: any) => {
        const day = new Date(t.updated_at).toLocaleDateString('en-US', {
          weekday: 'short',
          timeZone: timezone,
        });
        return `- ${day}: [${t.status === 'completed' ? 'x' : ' '}] ${t.title} (${t.priority || 'normal'}, ${t.aspect || t.category || 'uncategorized'})`;
      }).join('\n');

      const dayGoals = goals.slice(0, 15).map((g: any) =>
        `- ${g.title}: ${g.status} (${g.aspect || g.category || 'uncategorized'})`
      ).join('\n');

      return { dayEvents, dayTasks, dayGoals, existingNotes };
    }

    // Research mode -- just needs existing notes for linking
    return { existingNotes };
  }
}
