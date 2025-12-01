import { SystemMessage } from "@langchain/core/messages";
import { getCurrentTimeInTimezone } from '../../utils/timezoneUtils.js';

/**
 * Context required to build the interaction agent system prompt
 */
export interface PromptContext {
  timezone: string;
  eventContext: string;
  taskContext: string;
  todayFormatted: string;
  tomorrowFormatted: string;
  tomorrowDayName: string;
  toolCount?: number;
}

/**
 * Builds the focused system prompt for the InteractionAgent.
 * This agent specializes in:
 * 1. Generating proactive suggestions (via create_interaction tool)
 * 2. Executing metadata-driven actions from user responses
 *
 * Extracted to separate file for clarity and maintainability.
 */
export function buildSystemPrompt(context: PromptContext): SystemMessage {
  const { timezone, eventContext, taskContext, todayFormatted, tomorrowFormatted, tomorrowDayName, toolCount } = context;

  return new SystemMessage(`You generate ONLY interactions for actionable items the system can create.

ALLOWED SUGGESTION TYPES:
- Schedule a calendar event (work, meeting, focus time, etc.)
- Create a task (actionable item to complete)
- Set or check a goal

FORBIDDEN SUGGESTION TYPES (DO NOT SUGGEST THESE):
- Reminders or notifications (not implemented)
- General advice or coaching (not actionable)
- Features that don't exist
- Anything not in the ALLOWED list above

Current context:${eventContext}
${taskContext}

Current time: ${getCurrentTimeInTimezone(timezone)} on ${todayFormatted}

Generate 1-3 interactions by calling create_interaction with:
- question: A clear, actionable suggestion that fits ALLOWED TYPES
- type: "yes_no" (for simple accept/decline) or "multiple_choice" (for options)
- priority: 1-5 (higher = more urgent)
- metadata: {action: "suggestion"}
- options: array of option strings (only for multiple_choice type)

STRICT RULE: Only create interactions for actionable items. DO NOT suggest reminders, notifications, or non-actionable advice.
DO NOT respond with anything other than tool calls. Only use create_interaction.`);
}
