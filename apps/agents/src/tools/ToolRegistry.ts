import { ToolCategory } from '../types/routing.js';
import { calendarTools } from './calendar/index.js';
import {
  createAspectTool,
  listAspectsTool,
  updateAspectTool,
  deleteAspectTool,
  archiveAspectTool
} from './aspects/index.js';
import { taskTools } from './tasks/index.js';
import { goalTools } from './goals/index.js';
import { profileTools } from './profile/index.js';
import { searchTools } from './search/index.js';
import { memoryTools } from './memory/index.js';
import { interactionTools } from './interactions/index.js';
import { rulesTools } from './rules/index.js';
import { getPlanTool, updatePlanTool } from './plans/index.js';
import { projectTools } from './projects/index.js';
import { reminderTools } from './reminders/index.js';
import { friendTools } from './friends/index.js';
import { sharedEventTools } from './shared-events/index.js';
// NOTE: interactionTools imported but NOT registered in default tools
// Interactions should only be created by Gerald (InteractionAgentGerald), not ConversationAgent
// This prevents accidental duplicate/proactive suggestions from the conversation flow

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, any> = new Map();

  private constructor() {
    this.registerDefaultTools();
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  private registerDefaultTools(): void {
    // Register all calendar tools
    calendarTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register all aspect tools
    this.tools.set(createAspectTool.name, createAspectTool);
    this.tools.set(listAspectsTool.name, listAspectsTool);
    this.tools.set(updateAspectTool.name, updateAspectTool);
    this.tools.set(deleteAspectTool.name, deleteAspectTool);
    this.tools.set(archiveAspectTool.name, archiveAspectTool);

    // Register all task tools
    taskTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register all goal tools
    goalTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register all profile tools
    profileTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register all search tools
    searchTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register all memory tools
    memoryTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register all rules tools
    rulesTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register plan tools
    this.tools.set(getPlanTool.name, getPlanTool);
    this.tools.set(updatePlanTool.name, updatePlanTool);

    // Register project tools
    projectTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register reminder tools
    reminderTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register friend tools
    friendTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register shared event tools
    sharedEventTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // NOTE: Interaction tools NOT registered here
    // Gerald (InteractionAgentGerald) has its own tool set for proactive suggestions
    // This separation prevents ConversationAgent from accidentally creating interactions
  }

  // Register a single tool
  registerTool(name: string, tool: any): void {
    this.tools.set(name, tool);
  }

  // Register multiple tools
  registerTools(tools: any[]): void {
    tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
  }

  // Get a specific tool by name
  getTool(name: string): any {
    return this.tools.get(name);
  }

  // Get multiple tools by names
  getTools(names: string[]): any[] {
    return names.map(name => this.tools.get(name)).filter(Boolean);
  }

  // Get all tools
  getAllTools(): any[] {
    return Array.from(this.tools.values());
  }

  // Get tools by category
  getToolsByCategory(category: ToolCategory | 'calendar' | 'interactions'): any[] {
    const categoryPrefixes: Record<string, string[]> = {
      // Split calendar: core (always) vs advanced (on-demand)
      calendar_core: ['create_event', 'update_event', 'delete_event', 'search_events', 'list_events'],
      calendar_advanced: ['delete_multiple_events', 'bulk_update_events', 'analyze_schedule', 'create_recurring_event', 'update_recurring_event', 'delete_recurring_event', 'find_free_time'],
      // Legacy "calendar" returns all calendar tools (for backward compat)
      calendar: ['create_event', 'update_event', 'delete_event', 'search_events', 'list_events', 'delete_multiple_events', 'bulk_update_events', 'analyze_schedule', 'create_recurring_event', 'update_recurring_event', 'delete_recurring_event', 'find_free_time'],
      // Trim aspects: only core 3 always, delete/archive on demand
      aspects: ['create_aspect', 'list_aspects', 'update_aspect', 'delete_aspect', 'archive_aspect'],
      tasks: ['create_task', 'update_task', 'delete_task', 'list_tasks', 'complete_task', 'search_tasks'],
      goals: ['create_goal', 'update_goal', 'list_goals', 'check_in_goal', 'delete_goal'],
      profile: ['get_profile', 'update_profile'],
      memory: ['search_memory_unified', 'manage_patterns', 'update_memory_advanced'],
      search: ['web_search', 'location_search'],
      interactions: ['create_interaction', 'create_rating'],
      rules: ['create_rule', 'list_rules', 'delete_rule', 'toggle_rule'],
      plans: ['get_plan', 'update_plan'],
      projects: ['create_project', 'list_projects', 'update_project', 'archive_project', 'unarchive_project', 'delete_project', 'tag_to_project'],
      reminders: ['create_reminder', 'update_reminder', 'delete_reminder', 'list_reminders'],
      friends: ['list_friends', 'get_pending_friend_requests', 'send_friend_request', 'accept_friend_request', 'decline_friend_request', 'remove_friend', 'update_friend_notes', 'add_friend_aspect', 'remove_friend_aspect'],
      'shared-events': ['add_event_member', 'remove_event_member', 'get_event_members', 'update_member_role'],
    };

    const toolNames = categoryPrefixes[category] || [];
    return this.getTools(toolNames);
  }

  // Get tools for InteractionAgentGerald
  // Gerald can create interactions AND directly create tasks/events/goals
  getGeraldAgentTools(): any[] {
    // Gerald gets ALL tools (same as conversation agent) so it can act on user responses
    // Plus interaction-specific tools for creating interactions
    const allTools = this.getAllTools();
    const toolNames = new Set(allTools.map(t => t.name));

    // Add interaction tools if not already registered
    for (const t of interactionTools) {
      if (!toolNames.has(t.name)) {
        allTools.push(t);
      }
    }

    console.log(`[GERALD TOOLS] Loaded ${allTools.length} tools (full toolset)`);
    return allTools;
  }

  // Get tools for OnboardingEnrichmentAgent — curated set for setup
  getOnboardingAgentTools(): any[] {
    const onboardingToolNames = new Set([
      // Aspects
      'create_aspect', 'update_aspect', 'list_aspects',
      // Goals
      'create_goal', 'update_goal',
      // Calendar
      'create_event', 'create_recurring_event', 'list_events',
      // Tasks
      'create_task',
      // Profile
      'update_profile', 'get_profile',
      // Notes
      'create_notes', 'update_notes', 'get_notes',
    ]);

    const tools = Array.from(this.tools.values()).filter((t: any) => onboardingToolNames.has(t.name));
    console.log(`[ONBOARDING TOOLS] Loaded ${tools.length} tools (curated set)`);
    return tools;
  }

  // Get tools for multiple categories (used by ContextRouter)
  getToolsForCategories(categories: ToolCategory[]): any[] {
    const toolNames = new Set<string>();
    for (const cat of categories) {
      const names = this.getToolsByCategory(cat as any).map(t => t.name);
      for (const name of names) toolNames.add(name);
    }
    return Array.from(this.tools.values()).filter(t => toolNames.has(t.name));
  }

  /**
   * Get tools by specific tool names + categories combined.
   * Used when router returns both specific tool names and categories.
   * Returns the union of both sets (deduped).
   */
  getToolsForRouting(specificTools?: string[], categories?: ToolCategory[]): any[] {
    const toolNames = new Set<string>();

    // Add specific tool names
    if (specificTools?.length) {
      for (const name of specificTools) toolNames.add(name);
    }

    // Add tools from categories
    if (categories?.length) {
      for (const cat of categories) {
        const names = this.getToolsByCategory(cat as any).map(t => t.name);
        for (const name of names) toolNames.add(name);
      }
    }

    return Array.from(this.tools.values()).filter(t => toolNames.has(t.name));
  }

  // Get tool names for a specific category
  getToolNames(category?: 'calendar' | 'aspects' | 'tasks' | 'goals' | 'profile' | 'memory' | 'search' | 'interactions' | 'rules' | 'plans' | 'projects' | 'reminders' | 'friends' | 'shared-events'): string[] {
    if (category) {
      return this.getToolsByCategory(category).map(tool => tool.name);
    }
    return Array.from(this.tools.keys());
  }

  // Check if a tool exists
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  // Remove a tool
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  // Clear all tools
  clear(): void {
    this.tools.clear();
  }

  // Get tool count
  getToolCount(): number {
    return this.tools.size;
  }
}