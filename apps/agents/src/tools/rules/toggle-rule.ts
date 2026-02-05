import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ruleService from "../../services/RuleService.js";

export const toggleRuleTool = tool(
  async ({ rule_id, enabled }, config) => {
    console.log(`[TOGGLE-RULE] Tool invoked! rule_id=${rule_id}, enabled=${enabled}`);

    const userId = config?.configurable?.userId;
    if (!userId) {
      console.error('[TOGGLE-RULE] No userId in config!');
      return "User ID required to toggle rules";
    }

    try {
      const updatedRule = await ruleService.toggleRule(userId, rule_id, enabled);

      if (!updatedRule) {
        console.error('[TOGGLE-RULE] Failed to toggle rule');
        return `Failed to ${enabled ? 'enable' : 'disable'} the rule. It may not exist or there was an error.`;
      }

      console.log(`[TOGGLE-RULE] Rule ${enabled ? 'enabled' : 'disabled'}: ${updatedRule.rule_text}`);

      return `Successfully ${enabled ? 'enabled' : 'disabled'} rule: "${updatedRule.rule_text}"`;
    } catch (error) {
      console.error('[TOGGLE-RULE] Error:', error);
      return `Error toggling rule: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "toggle_rule",
    description: "Enable or disable an existing rule. Use this to re-enable a previously disabled rule instead of creating a duplicate, or to temporarily disable a rule without deleting it.",
    schema: z.object({
      rule_id: z.string().describe("The ID of the rule to enable or disable"),
      enabled: z.boolean().describe("Whether to enable (true) or disable (false) the rule"),
    }),
  }
);
