# Fix: Zep Graph Memory Context Retrieval - January 2025

## Problem
The `getUserContext()` method in ZepMemoryService was broken because:
1. It was searching the Zep graph correctly
2. BUT then filtering results to only include episodes with "conversation" in their content
3. The Zep graph stores **entities** (CalendarEvent, Task, Goal, Pattern), not conversation episodes
4. This filter rejected ALL graph entities, returning empty results
5. Agent would see "No graph context found" and have no knowledge of user's calendar, tasks, goals, or patterns

Result: Agent responses were generic and lacked important user context.

## Solution
Updated `getUserContext()` and `searchMemory()` methods in `/apps/agents/src/services/ZepMemoryService.ts`:

### Key Changes:
1. **`getUserContext()`** (lines 196-222):
   - Now explicitly searches for graph entities: "events tasks goals patterns productivity schedule"
   - Removed conversation-focused language
   - Simplified logging to reflect graph context retrieval, not conversation history
   - Cleaner error handling

2. **`searchMemory()`** (lines 224-265):
   - **CRITICAL FIX**: Removed the filter that was rejecting non-conversation content
   - Now searches with `scope: 'edges'` to get relationship entities
   - Extracts both edges (relationships like SCHEDULED, COMPLETED_TASK) and nodes (entities)
   - Formats each result as readable content strings with relevance scores
   - Returns up to `limit` items combining edges and nodes

### Technical Details:
- **Edges**: Relationships like SCHEDULED (event scheduled for user), COMPLETED_TASK, PURSUING_GOAL
  - Formatted as: `edge.fact?.description || JSON.stringify(edge.fact)`
- **Nodes**: Entity nodes like CalendarEvent, Task, Goal, Pattern
  - Formatted as: `node.fact?.description || node.name || JSON.stringify(node.fact)`
- **Rating/Relevance**: Zep graph stores fact ratings (0-1); defaults to 0.7 if not provided

## Architecture Alignment
- **ZepMemoryService**: Manages thread-based message history AND graph context retrieval
- **ZepGraphService**: Manages entity lifecycle (add, update calendar events, tasks, goals)
- **Two-layer memory system**:
  - Thread layer: Recent conversation messages
  - Graph layer: Structured entities (events, tasks, goals, patterns) and insights

## Testing
The fix enables agents to:
1. Retrieve user's upcoming calendar events from graph
2. See user's active tasks and goals
3. Access detected behavioral patterns
4. Use this context to make better decisions and recommendations

When agent processes a message, it will now see actual user data instead of empty context.

## Files Modified
- `/apps/agents/src/services/ZepMemoryService.ts`
  - `getUserContext()` method (lines 196-222)
  - `searchMemory()` method (lines 224-265)

## Enhanced Search Strategy (v2 - Targeted Queries)
Updated search approach to handle personal data better:
1. **Multiple targeted queries** - Instead of one generic query, now searches for:
   - Flight confirmations, travel bookings, reservations
   - Personal preferences, habits, patterns
   - Important contacts and relationships
   - Medical/health information
   - Financial preferences and accounts
   - Home address and location details
2. **Dual scope search** - Searches both edges (relationships) AND nodes (entities)
3. **Better formatting** - Extracts and formats node properties, source→target relationships
4. **Deduplication** - Removes duplicate results and prioritizes nodes over edges

## Integration with ConversationAgent (Complete Loop)
Now that `getUserContext()` works properly, the ConversationAgent has been updated to:
1. **Load Zep graph context** in the `callModel` function (lines 231-240)
2. **Pass zepGraphContext to buildSystemPrompt** (line 261)
3. **Include zepGraphContext in system prompt** after tasks section
4. **Agent sees personal data** like flight confirmations, travel details, preferences during inference

### Updated Files:
- `ConversationAgent.ts`: Added Zep graph context loading and passing to prompt
- `prompts.ts`: Added `zepGraphContext` to PromptContext interface and system prompt template

## Related Services
- `ZepGraphService` - Handles graph entity operations
- `BaseAgent` - Calls `getMemoryContext()` to get context for message processing
- `ConversationAgent` - Now loads and uses Zep graph context in system prompt
- `SupabaseService` - Provides calendar events and tasks (still needed for immediate data)
