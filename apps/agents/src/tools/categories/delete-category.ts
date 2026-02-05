import { tool } from "@langchain/core/tools";
import { z } from "zod";
import CategoryService from "../../services/CategoryService.js";

export const deleteCategoryTool = tool(
  async ({ name }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      // Find category by name
      const existing = await CategoryService.getCategoryByName(userId, name);
      if (!existing) {
        return `Category "${name}" not found`;
      }

      await CategoryService.deleteCategory(userId, existing.id);

      return `Deleted category "${name}"`;
    } catch (error) {
      console.error('[delete-category] Error:', error);
      return `Error deleting category: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "delete_category",
    description: "Delete a category. WARNING: Only use this if the user explicitly requests deletion. This may affect existing events/tasks/goals using this category.",
    schema: z.object({
      name: z.string().describe("Category name to delete"),
    }),
  }
);
