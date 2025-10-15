import { tool } from "@langchain/core/tools";
import { z } from "zod";
import CategoryService from "../../services/CategoryService.js";

export const createCategoryTool = tool(
  async ({ name, color, icon, description, context }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      // Check if category already exists
      const existing = await CategoryService.getCategoryByName(userId, name);
      if (existing) {
        return `✅ Category "${name}" already exists with color ${existing.color}`;
      }

      const category = await CategoryService.createCategory(userId, {
        name,
        color: color || '#3b82f6',
        icon: icon,
        description: description,
        context: context,
      });

      if (!category) {
        return "❌ Failed to create category";
      }

      return `✅ Created category: "${name}" ${icon || ''} (${color || '#3b82f6'})`;
    } catch (error) {
      console.error('❌ [create-category] Error:', error);
      return `❌ Error creating category: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_category",
    description: "Create a new category for organizing events, tasks, and goals. Categories are universal and can be used by all entity types. CRITICAL: Create SPECIFIC, GRANULAR categories for specific entities - individual classes (e.g., 'CS173A', 'PHIL 1'), projects (e.g., 'Project Phoenix'), clients (e.g., 'Client Acme'). Generic categories (Personal, Fitness, Social) should ONLY be used for truly generic recurring activities. Always check existing categories with list_categories before creating.",
    schema: z.object({
      name: z.string().describe("Category name (e.g., 'Gym', 'Project X', 'Doctor Appointments')"),
      color: z.string().optional().describe("Hex color code (e.g., '#3b82f6'). Use meaningful colors that match the category type."),
      icon: z.string().optional().describe("Emoji icon (e.g., '🏋️', '📊', '🏥')"),
      description: z.string().optional().describe("Description of what this category is for"),
      context: z.record(z.any()).optional().describe("AI context object with preferences and patterns for this category"),
    }),
  }
);
