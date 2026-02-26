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
  getToolsByCategory(category: 'calendar' | 'aspects' | 'tasks' | 'goals' | 'profile' | 'memory' | 'search' | 'interactions' | 'rules' | 'plans' | 'projects' | 'reminders'): any[] {
    const categoryPrefixes = {
      calendar: ['create_event', 'update_event', 'delete_event', 'delete_multiple_events', 'bulk_update_events', 'search_events', 'list_events', 'analyze_schedule'],
      aspects: ['create_aspect', 'list_aspects', 'update_aspect', 'delete_aspect', 'archive_aspect'],
      tasks: ['create_task', 'update_task', 'delete_task', 'list_tasks', 'complete_task', 'search_tasks'],
      goals: ['create_goal', 'update_goal', 'list_goals', 'check_in_goal', 'delete_goal'],
      profile: ['get_profile', 'update_profile'],
      memory: ['search_memory_unified', 'manage_patterns'],
      search: ['web_search', 'location_search'],
      interactions: ['create_interaction', 'create_rating'],
      rules: ['create_rule', 'list_rules', 'delete_rule'],
      plans: ['get_plan', 'update_plan'],
      projects: ['create_project', 'list_projects', 'update_project', 'archive_project', 'tag_to_project'],
      reminders: ['create_reminder', 'update_reminder', 'delete_reminder', 'list_reminders']
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

  // Get tool names for a specific category
  getToolNames(category?: 'calendar' | 'aspects' | 'tasks' | 'goals' | 'profile' | 'memory' | 'search' | 'interactions' | 'rules' | 'plans' | 'projects' | 'reminders'): string[] {
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