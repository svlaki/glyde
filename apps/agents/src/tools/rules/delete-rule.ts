import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ruleService from "../../services/RuleService.js";

export const deleteRuleTool = tool(
  async ({ rule_id, search_query }, config) => {
    console.log('[DELETE-RULE] Tool invoked!');
    console.log('[DELETE-RULE] Args:', JSON.stringify({ rule_id, search_query }, null, 2));

    const userId = config?.configurable?.userId;
    if (!userId) {
      console.error('[DELETE-RULE] No userId in config!');
      return "User ID required to delete a rule";
    }

    try {
      // If rule_id is provided, delete directly
      if (rule_id) {
        const result = await ruleService.deleteRule(userId, rule_id);
        if (!result.success) {
          return `Failed to delete rule: ${result.error || 'Rule not found'}`;
        }
        console.log(`[DELETE-RULE] Rule deleted: ${rule_id}`);
        return `Rule deleted successfully.`;
      }

      // If search_query is provided, find matching rules first
      if (search_query) {
        const matchingRules = await ruleService.searchRules(userId, search_query);

        if (matchingRules.length === 0) {
          return `No rules found matching "${search_query}". Use list_rules to see all rules.`;
        }

        if (matchingRules.length === 1) {
          // Delete the single match
          const rule = matchingRules[0];
          const result = await ruleService.deleteRule(userId, rule.id);
          if (!result.success) {
            return `Failed to delete rule: ${result.error}`;
          }
          console.log(`[DELETE-RULE] Rule deleted: ${rule.id}`);
          return `Rule deleted successfully: "${rule.rule_text}"`;
        }

        // Multiple matches - list them for user to choose
        const matchList = matchingRules.map((r, i) =>
          `${i + 1}. "${r.rule_text}" (ID: ${r.id})`
        ).join('\n');

        return `Found ${matchingRules.length} rules matching "${search_query}":\n${matchList}\n\nPlease specify which rule to delete by using the rule_id.`;
      }

      return "Please provide either a rule_id or a search_query to find the rule to delete.";
    } catch (error) {
      console.error('[DELETE-RULE] Error:', error);
      return `Error deleting rule: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "delete_rule",
    description: "Delete a rule. You can either provide the rule_id directly, or use search_query to find and delete a rule by its content.",
    schema: z.object({
      rule_id: z.string().optional().nullable().describe("The ID of the rule to delete (UUID format)"),
      search_query: z.string().optional().nullable().describe("Search text to find a rule by its content. If multiple rules match, they will be listed for the user to choose."),
    }),
  }
);
