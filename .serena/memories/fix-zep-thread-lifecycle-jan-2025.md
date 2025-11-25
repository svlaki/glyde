# Fix: Zep Thread Lifecycle Management

## Problem
After refactoring to use Zep's built-in `thread.getUserContext()` API, encountered 404 errors because threads weren't created in Zep before attempting to retrieve their context.

## Root Cause
The `callModel` function in ConversationAgent was generating a threadId dynamically but never creating that thread in Zep:
```typescript
const threadId = (state as any).threadId || `conversation-${state.userId}-${Date.now()}`;
zepThreadContext = await this.zepService.getThreadContext(threadId); // 404!
```

Meanwhile, `ZepMemoryService.getOrCreateSession()` existed but was private and not being called.

## Solution
1. **Made `getOrCreateSession()` public** in ZepMemoryService
   - Changed from `private async getOrCreateSession(userId: string)` to `async getOrCreateSession(userId: string)`
   - This method was already creating threads via `this.client.thread.create()`

2. **Called `getOrCreateSession()` before context retrieval** in ConversationAgent
   ```typescript
   const threadId = await this.zepService.getOrCreateSession(state.userId);
   zepThreadContext = await this.zepService.getThreadContext(threadId);
   ```
   - Now ensures thread exists in Zep before attempting to retrieve context
   - Caches thread ID in userSessions map to avoid recreating per invocation

## Files Modified
- `/apps/agents/src/services/ZepMemoryService.ts`: Made `getOrCreateSession()` public
- `/apps/agents/src/agents/conversation/ConversationAgent.ts`: Call `getOrCreateSession()` before `getThreadContext()`

## Messages Order Issue (DISCOVERED)
Initial thread creation worked, but context was empty because:
- User message was added to Zep AFTER context retrieval (in persistConversationToMemory)
- Zep's getUserContext() only includes messages that exist in the thread
- Thread was created but empty when context was retrieved

## Solution - Split Message Handling
1. **Added `addUserMessage()` to ZepMemoryService**
   - Called BEFORE context retrieval in processMessage
   - Ensures current message is in thread when getUserContext() is called
   - Uses getOrCreateSession() to ensure thread exists

2. **Added `addAssistantMessage()` to ZepMemoryService**
   - Called AFTER generating response
   - Adds assistant message to thread for future context

3. **Updated ConversationAgent**
   - Calls `addUserMessage()` immediately after getting timezone (line 68)
   - Calls `addAssistantMessage()` after generating response (line 129)
   - Messages are now available in proper order for context retrieval

## Result
- ✅ No more 404 errors when retrieving Zep context
- ✅ Threads are properly created and cached per user session
- ✅ Current message is included in context retrieval (critical!)
- ✅ Personal data (flight confirmations, preferences) can now be retrieved from Zep graph
- ✅ Context is built from actual conversation history, not empty threads
- ✅ TypeScript type checks pass

## Implementation Complete
The interaction system with Zep memory integration is now fully functional:
1. Agents create interactions with metadata-driven actions
2. User responds to interactions
3. Backend retrieves interaction metadata and invokes agent
4. Agent adds user message to Zep, retrieves enriched context
5. Agent generates response with personalization from Zep
6. Agent adds assistant message to Zep for future context
7. All actions are persisted and available for future context
