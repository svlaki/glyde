import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ruleService from "../../services/RuleService.js";

export const createRuleTool = tool(
  async ({ rule_text, description, priority }, config) => {
    console.log('[CREATE-RULE] Tool invoked!');
    console.log('[CREATE-RULE] Config:', JSON.stringify(config, null, 2));
    console.log('[CREATE-RULE] Args:', JSON.stringify({ rule_text, description, priority }, null, 2));

    const userId = config?.configurable?.userId;
    if (!userId) {
      console.error('[CREATE-RULE] No userId in config!');
      return "User ID required to create a rule";
    }

    if (!rule_text || rule_text.trim().length === 0) {
      return "Rule text cannot be empty";
    }

    try {
      const rule = await ruleService.createRule(userId, {
        rule_text: rule_text.trim(),
        description: description?.trim() || undefined,
        priority: priority || 5,
        source: 'agent'
      });

      if (!rule) {
        return "Failed to create rule. This rule may already exist.";
      }

      console.log(`[CREATE-RULE] Rule created: "${rule_text}" (ID: ${rule.id})`);

      return `Rule created successfully: "${rule_text}"${description ? ` - ${description}` : ''}. I'll follow this rule in all future interactions.`;
    } catch (error) {
      console.error('[CREATE-RULE] Error:', error);
      return `Error creating rule: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_rule",
    description: "Create a persistent behavioral rule.",
    schema: z.object({
      rule_text: z.string().describe("Rule instruction"),
      description: z.string().optional().nullable().describe("Why this rule exists"),
      priority: z.number().min(1).max(10).optional().nullable().describe("Priority 1-10 (default 5)"),
    }),
  }
);
