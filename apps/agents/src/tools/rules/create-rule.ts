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
    description: `Create a persistent rule that guides agent behavior. Use this when:
- User explicitly asks to "always" or "never" do something
- User says "from now on..." or "going forward..."
- User makes a general behavioral request (not task-specific)
- You notice a pattern the user wants maintained

Examples: "Always respond formally", "Never schedule meetings before 9am", "Use 30-minute blocks for focus work"`,
    schema: z.object({
      rule_text: z.string().describe("The rule instruction. Be specific and actionable. Example: 'Always use 30-minute time blocks for focus work'"),
      description: z.string().optional().nullable().describe("Optional explanation of why this rule exists or when it applies"),
      priority: z.number().min(1).max(10).optional().nullable().describe("Priority level 1-10 (10 = highest). Default is 5. Higher priority rules take precedence when rules conflict."),
    }),
  }
);
