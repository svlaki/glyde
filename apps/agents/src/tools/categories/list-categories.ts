import { tool } from "@langchain/core/tools";
import { z } from "zod";
import CategoryService from "../../services/CategoryService.js";

export const listCategoriesTool = tool(
  async ({}, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const categories = await CategoryService.getCategories(userId);

      if (categories.length === 0) {
        return "No categories found. Create categories as needed when users mention new types of activities.";
      }

      const categoriesList = categories.map(cat =>
        `• "${cat.name}" (${cat.color}) - ${cat.description || 'No description'}`
      ).join('\n');

      return `Available categories (${categories.length}). Use the exact name in quotes when assigning:\n${categoriesList}`;
    } catch (error) {
      console.error('❌ [list-categories] Error:', error);
      return `❌ Error listing categories: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "list_categories",
    description: "List all available categories. ALWAYS use this before creating events/tasks/goals to see what categories exist. All categories are universal and can be used for events, tasks, and goals.",
    schema: z.object({}),
  }
);
