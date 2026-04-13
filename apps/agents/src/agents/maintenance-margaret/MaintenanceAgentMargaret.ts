import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { BaseAgent } from "../base/BaseAgent.js";
import { AgentContext, AgentResponse } from "../../types/agents.js";
import { SupabaseService } from "../../services/SupabaseService.js";
import { isValidTimezone } from "../../utils/timezoneUtils.js";
import { buildMargaretSystemPrompt } from "./prompts.js";

export class MaintenanceAgentMargaret extends BaseAgent {
  constructor() {
    super('maintenance', "gpt-5.4-nano"); // gpt-5.4-nano: cheapest for structured audit/cleanup tasks
  }

  async initialize(): Promise<void> {
    console.log('[MARGARET] MaintenanceAgentMargaret initialized');
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    try {
      await this.loadMemoryContext(context, 'conversation');

      const supabaseService = new SupabaseService();
      const userProfile = await supabaseService.getProfile(context.userId);
      let userTimezone = userProfile?.timezone || context.timezone || 'UTC';
      if (!isValidTimezone(userTimezone)) {
        console.warn(`[MARGARET] Invalid timezone "${userTimezone}", falling back to UTC`);
        userTimezone = 'UTC';
      }

      console.log(`[MARGARET] Processing for user ${context.userId} in timezone ${userTimezone}`);

      // Memory context loaded via base class

      const [events, tasks, goals, aspects] = await Promise.all([
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getAspects(context.userId)
      ]);

      const messages: BaseMessage[] = [];
      const recentHistory = context.conversationHistory?.slice(-10) || [];

      for (const msg of recentHistory) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (msg.role === 'user') {
          messages.push(new HumanMessage(content));
        } else if (msg.role === 'assistant') {
          messages.push(new AIMessage(content));
        } else {
          messages.push(new SystemMessage(content));
        }
      }

      messages.unshift(
        buildMargaretSystemPrompt({
          timezone: userTimezone,
          profileContext: this.buildProfileContext(userProfile),
          aspectContext: this.buildAspectContext(aspects),
          goalContext: this.buildGoalContext(goals),
          taskContext: this.buildTaskContext(tasks),
          eventContext: this.buildEventContext(events)
        })
      );

      messages.push(new HumanMessage(message));

      const result = await this.model.invoke(messages);
      const response = result.content?.toString?.() || "Margaret completed the maintenance review.";

      // Track token usage
      this.trackTokenUsage(context.userId, context.sessionId || `margaret-${Date.now()}`, [result]);

      try {
        await this.persistConversationToMemory(context, message, response);
      } catch (error) {
        console.warn('[MARGARET] Failed to persist conversation to memory:', error);
      }

      return {
        content: response,
        type: 'text'
      };
    } catch (error) {
      console.error('[MARGARET] Error processing message:', error);
      return {
        content: "Sorry, I encountered an error while running maintenance. Please try again.",
        type: 'text'
      };
    }
  }

  getSystemPrompt(): string {
    return "UNUSED - See buildMargaretSystemPrompt in prompts.ts";
  }

  getCapabilities(): string[] {
    return [
      "Audit aspect coverage for goals, tasks, and events",
      "Suggest merges/splits for aspects based on overlap",
      "Highlight items without aspects or with wrong aspects",
      "Propose aspect description refreshes from observed data",
      "Provide safe, low-risk maintenance recommendations"
    ];
  }

  private buildProfileContext(profile: any): string {
    if (!profile) {
      return "No profile data available.";
    }

    return [
      `Name: ${profile.display_name || profile.displayName || 'Unknown'}`,
      `Email: ${profile.email || 'Unknown'}`,
      `Timezone: ${profile.timezone || 'Unknown'}`
    ].join('\n');
  }

  private buildAspectContext(aspects: any[]): string {
    if (!aspects || aspects.length === 0) {
      return "No aspects found.";
    }

    const trimmed = aspects.slice(0, 50);
    return trimmed.map((aspect: any) => {
      return `- ${aspect.name} (id: ${aspect.id})${aspect.description ? `: ${aspect.description}` : ''}`;
    }).join('\n');
  }

  private buildGoalContext(goals: any[]): string {
    if (!goals || goals.length === 0) {
      return "No goals found.";
    }

    const trimmed = goals.slice(0, 50);
    return trimmed.map((goal: any) => {
      return `- ${goal.title || 'Untitled goal'} [status: ${goal.status || 'unknown'}]` +
        `${goal.aspect_name ? ` [aspect: ${goal.aspect_name}]` : ''}` +
        `${goal.description ? ` - ${goal.description}` : ''}`;
    }).join('\n');
  }

  private buildTaskContext(tasks: any[]): string {
    if (!tasks || tasks.length === 0) {
      return "No tasks found.";
    }

    const trimmed = tasks.slice(0, 80);
    return trimmed.map((task: any) => {
      return `- ${task.title || 'Untitled task'} [status: ${task.status || 'unknown'}]` +
        `${task.aspect_name ? ` [aspect: ${task.aspect_name}]` : ''}` +
        `${task.description ? ` - ${task.description}` : ''}`;
    }).join('\n');
  }

  private buildEventContext(events: any[]): string {
    if (!events || events.length === 0) {
      return "No events found.";
    }

    const trimmed = events.slice(0, 80);
    return trimmed.map((event: any) => {
      const start = event.start_time ? new Date(event.start_time).toISOString() : 'unknown';
      const end = event.end_time ? new Date(event.end_time).toISOString() : 'unknown';
      return `- ${event.title || 'Untitled event'} (${start} → ${end})` +
        `${event.aspect_name ? ` [aspect: ${event.aspect_name}]` : ''}` +
        `${event.description ? ` - ${event.description}` : ''}`;
    }).join('\n');
  }
}
