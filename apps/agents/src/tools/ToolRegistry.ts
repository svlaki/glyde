import { calendarTools } from './calendar/index.js';
import {
  createCategoryTool,
  listCategoriesTool,
  updateCategoryTool,
  deleteCategoryTool
} from './categories/index.js';
import { taskTools } from './tasks/index.js';
import { goalTools } from './goals/index.js';
import { profileTools } from './profile/index.js';
import { searchTools } from './search/index.js';
import { memoryTools } from './memory/index.js';
import { interactionTools } from './interactions/index.js';
import { rulesTools } from './rules/index.js';
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

    // Register all category tools
    this.tools.set(createCategoryTool.name, createCategoryTool);
    this.tools.set(listCategoriesTool.name, listCategoriesTool);
    this.tools.set(updateCategoryTool.name, updateCategoryTool);
    this.tools.set(deleteCategoryTool.name, deleteCategoryTool);

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
  getToolsByCategory(category: 'calendar' | 'categories' | 'tasks' | 'goals' | 'profile' | 'memory' | 'search' | 'interactions' | 'rules'): any[] {
    const categoryPrefixes = {
      calendar: ['create_event', 'update_event', 'delete_event', 'delete_multiple_events', 'bulk_update_events', 'search_events', 'list_events', 'analyze_schedule'],
      categories: ['create_category', 'list_categories', 'update_category', 'delete_category'],
      tasks: ['create_task', 'update_task', 'delete_task', 'list_tasks', 'complete_task', 'search_tasks'],
      goals: ['create_goal', 'update_goal', 'list_goals', 'check_in_goal', 'delete_goal'],
      profile: ['get_profile', 'update_profile'],
      memory: ['search_memory_unified', 'manage_patterns'],
      search: ['web_search'],
      interactions: ['create_interaction'],
      rules: ['create_rule', 'list_rules', 'delete_rule']
    };

    const toolNames = categoryPrefixes[category] || [];
    return this.getTools(toolNames);
  }

  // Get tools for InteractionAgentGerald
  // Gerald can create interactions AND directly create tasks/events/goals
  getGeraldAgentTools(): any[] {
    // Include interaction tools
    const tools = [...interactionTools];

    // Add creation tools for tasks, events, goals
    const creationToolNames = [
      'create_task',
      'create_event',
      'create_goal',
    ];

    creationToolNames.forEach(name => {
      const tool = this.tools.get(name);
      if (tool) {
        tools.push(tool);
      }
    });

    console.log(`🤖 [GERALD TOOLS] Loaded ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);
    return tools;
  }

  // Get tool names for a specific category
  getToolNames(category?: 'calendar' | 'categories' | 'tasks' | 'goals' | 'profile' | 'memory' | 'search' | 'interactions' | 'rules'): string[] {
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