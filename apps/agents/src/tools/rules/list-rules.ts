import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ruleService from "../../services/RuleService.js";

export const listRulesTool = tool(
  async ({ include_disabled }, config) => {
    console.log('📋 [LIST-RULES] Tool invoked!');

    const userId = config?.configurable?.userId;
    if (!userId) {
      console.error('📋 [LIST-RULES] No userId in config!');
      return "User ID required to list rules";
    }

    try {
      const rules = include_disabled
        ? await ruleService.getRules(userId)
        : await ruleService.getEnabledRules(userId);

      if (rules.length === 0) {
        return "No rules found. You can create rules using the create_rule tool.";
      }

      const formattedRules = rules.map((rule, index) => {
        const status = rule.enabled ? '' : ' [DISABLED]';
        const priority = `[Priority: ${rule.priority}]`;
        const source = rule.source === 'agent' ? ' (created by AI)' : ' (created manually)';
        return `${index + 1}. ${rule.rule_text}${status} ${priority}${source}${rule.description ? `\n   Description: ${rule.description}` : ''}`;
      }).join('\n\n');

      console.log(`✅ [LIST-RULES] Found ${rules.length} rules`);

      return `Current Rules (${rules.length}):\n\n${formattedRules}`;
    } catch (error) {
      console.error('❌ [LIST-RULES] Error:', error);
      return `Error listing rules: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "list_rules",
    description: "List all active rules that guide agent behavior. Use this to check what rules are currently in effect before creating new ones or when user asks about their rules.",
    schema: z.object({
      include_disabled: z.boolean().optional().nullable().describe("Whether to include disabled rules. Default is false (only show enabled rules)."),
    }),
  }
);
