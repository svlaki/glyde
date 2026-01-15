import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { BaseAgent } from "../base/BaseAgent.js";
import { AgentContext, AgentResponse } from "../../types/agents.js";
import { SupabaseService } from "../../services/SupabaseService.js";
import { buildMargaretSystemPrompt } from "./prompts.js";

export class MaintenanceAgentMargaret extends BaseAgent {
  constructor() {
    super('maintenance', "gpt-5.1");
  }

  async initialize(): Promise<void> {
    console.log('🧹 [MARGARET] MaintenanceAgentMargaret initialized');
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    try {
      await this.loadMemoryContext(context, 'conversation');

      const supabaseService = new SupabaseService();
      const userProfile = await supabaseService.getProfile(context.userId);
      const userTimezone = userProfile?.timezone || context.timezone || 'UTC';

      console.log(`🧹 [MARGARET] Processing for user ${context.userId} in timezone ${userTimezone}`);

      try {
        await this.zepService.addUserMessage(context.userId, message);
      } catch (error) {
        console.warn('[MARGARET] Failed to add user message to Zep:', error);
      }

      const [events, tasks, goals, categories] = await Promise.all([
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getCategories(context.userId)
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
          categoryContext: this.buildCategoryContext(categories),
          goalContext: this.buildGoalContext(goals),
          taskContext: this.buildTaskContext(tasks),
          eventContext: this.buildEventContext(events)
        })
      );

      messages.push(new HumanMessage(message));

      const result = await this.model.invoke(messages);
      const response = result.content?.toString?.() || "Margaret completed the maintenance review.";

      try {
        await this.zepService.addAssistantMessage(context.userId, response);
      } catch (error) {
        console.warn('[MARGARET] Failed to add assistant message to Zep:', error);
      }

      return {
        content: response,
        type: 'text'
      };
    } catch (error) {
      console.error('🧹 [MARGARET] Error processing message:', error);
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
      "Audit category/aspect coverage for goals, tasks, and events",
      "Suggest merges/splits for categories based on overlap",
      "Highlight uncategorized or miscategorized items",
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

  private buildCategoryContext(categories: any[]): string {
    if (!categories || categories.length === 0) {
      return "No categories found.";
    }

    const trimmed = categories.slice(0, 50);
    return trimmed.map((category: any) => {
      return `- ${category.name} (id: ${category.id})${category.description ? `: ${category.description}` : ''}`;
    }).join('\n');
  }

  private buildGoalContext(goals: any[]): string {
    if (!goals || goals.length === 0) {
      return "No goals found.";
    }

    const trimmed = goals.slice(0, 50);
    return trimmed.map((goal: any) => {
      return `- ${goal.title || 'Untitled goal'} [status: ${goal.status || 'unknown'}]` +
        `${goal.category ? ` [category: ${goal.category}]` : ''}` +
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
        `${task.category ? ` [category: ${task.category}]` : ''}` +
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
        `${event.category || event.category_name ? ` [category: ${event.category_name || event.category}]` : ''}` +
        `${event.description ? ` - ${event.description}` : ''}`;
    }).join('\n');
  }
}
