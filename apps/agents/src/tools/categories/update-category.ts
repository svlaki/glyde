import { tool } from "@langchain/core/tools";
import { z } from "zod";
import CategoryService from "../../services/CategoryService.js";

export const updateCategoryTool = tool(
  async ({ name, newName, color, icon, description, context }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      // Find category by name
      const existing = await CategoryService.getCategoryByName(userId, name);
      if (!existing) {
        return `❌ Category "${name}" not found. Use list_categories to see available categories.`;
      }

      // Prepare updates
      const updates: any = {};
      if (newName) updates.name = newName;
      if (color) updates.color = color;
      if (icon !== undefined) updates.icon = icon;
      if (description !== undefined) updates.description = description;
      if (context !== undefined) updates.context = context;

      const updated = await CategoryService.updateCategory(userId, existing.id, updates);

      if (!updated) {
        return "❌ Failed to update category";
      }

      return `✅ Updated category "${name}"${newName ? ` → "${newName}"` : ''}`;
    } catch (error) {
      console.error('❌ [update-category] Error:', error);
      return `❌ Error updating category: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_category",
    description: "Update an existing category's properties. Use this to change category colors, icons, descriptions, or AI context based on user preferences or learned patterns.",
    schema: z.object({
      name: z.string().describe("Current category name to update"),
      newName: z.string().optional().nullable().describe("New name for the category"),
      color: z.string().optional().nullable().describe("New hex color code"),
      icon: z.string().optional().nullable().describe("New emoji icon"),
      description: z.string().optional().nullable().describe("New description"),
      context: z.record(z.any()).optional().nullable().describe("Updated AI context object"),
    }),
  }
);
