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
  getToolsByCategory(category: 'calendar' | 'categories' | 'tasks' | 'analysis' | 'coaching' | 'chat'): any[] {
    const categoryPrefixes = {
      calendar: ['create_event', 'update_event', 'delete_event', 'delete_multiple_events', 'search_events', 'list_events'],
      categories: ['create_category', 'list_categories', 'update_category', 'delete_category'],
      tasks: ['create_task', 'update_task', 'delete_task', 'list_tasks'],
      analysis: ['analyze_patterns', 'generate_insights'],
      coaching: ['set_goal', 'track_progress', 'suggest_actions'],
      chat: ['search_similar', 'update_memory']
    };

    const toolNames = categoryPrefixes[category] || [];
    return this.getTools(toolNames);
  }

  // Get tool names for a specific category
  getToolNames(category?: 'calendar' | 'categories' | 'tasks' | 'analysis' | 'coaching' | 'chat'): string[] {
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