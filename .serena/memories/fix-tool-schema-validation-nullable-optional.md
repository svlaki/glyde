# Tool Schema Validation Fix: .nullable() → .optional()

## Problem
The agent was entering an infinite loop with the `update_event` tool because LangChain's ToolNode was rejecting tool inputs with the error:
```
Error: Received tool input did not match expected schema
```

This occurred because:
1. Tools were using Zod's `.nullable()` to accept optional fields
2. LangChain's tool validation doesn't handle `.nullable()` well when the LLM sends actual data (vs undefined)
3. The schema validation was failing before the tool could execute, causing the agent to retry infinitely

## Solution
Replaced all `.nullable()` with `.optional()` in tool schemas. The difference:
- `.nullable()`: Allows `null` type explicitly (causes LangChain validation issues)
- `.optional()`: Makes field undefined when not provided (works with LangChain validation)

## Files Fixed
### Calendar Tools
- `apps/agents/src/tools/calendar/update-event.ts`
- `apps/agents/src/tools/calendar/create-event.ts`
- `apps/agents/src/tools/calendar/list-events.ts`
- `apps/agents/src/tools/calendar/search-events.ts`
- `apps/agents/src/tools/calendar/bulk-update-events.ts`
- `apps/agents/src/tools/calendar/delete-multiple-events.ts`

### Task Tools
- `apps/agents/src/tools/tasks/create-task.ts`
- `apps/agents/src/tools/tasks/update-task.ts`
- `apps/agents/src/tools/tasks/list-tasks.ts`
- `apps/agents/src/tools/tasks/search-tasks.ts`
- `apps/agents/src/tools/tasks/complete-task.ts`

### Interaction Tools
- `apps/agents/src/tools/interactions/create-interaction.ts`

## Key Changes
All occurrences of `.nullable()` were changed to `.optional()`:

```typescript
// Before
title: z.string().nullable().describe("...")
category: z.string().nullable().optional().describe("...")

// After
title: z.string().optional().describe("...")
category: z.string().optional().describe("...")
```

## Impact
- Fixes the infinite loop in update_event and similar tools
- Improves tool invocation reliability across all agents
- LangChain now validates schemas correctly without rejecting valid inputs
- No functional changes to tool behavior - only schema validation improvements

## Related
- This was causing the ConversationAgent to infinitely retry tool calls
- Affects all tools in the ToolRegistry that use optional fields
