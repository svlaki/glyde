# Zep Memory Persistence Issue: Internal Messages

## Problem
Agent is not retrieving memory context from Zep. Logs show:
```
📭 [ZepMemoryService] No memory context found for {userId}
```

## Root Cause
When user responds to interactions, the `respondToInteraction()` endpoint creates an AgentContext with `isInternal: true`:

```typescript
const context = {
  userId,
  sessionId,
  userSchema: 'public',
  timezone,
  conversationHistory: [],
  isInternal: true  // ← SKIPS ZEP PERSISTENCE
};
```

The `isInternal: true` flag causes the agent to skip calling `zepService.addConversation()` in BaseAgent's `persistMessage()` method:

```typescript
if (context.isInternal) {
  console.log(`Skipping persistence for internal message from user ${context.userId}`);
  return;
}
```

## Why This Causes Problems
1. Regular chat messages ARE persisted to Zep
2. Interaction responses are marked `isInternal: true` to avoid creating duplicate messages
3. But this also prevents them from being searchable via Zep memory
4. So agent can't access its own history when processing responses

## Solution Options

### Option A: Remove `isInternal` flag (BEST)
Don't mark interaction responses as internal. The agent will naturally avoid duplicating them because:
- The response is only sent to the agent, not stored as a new chat message
- The agent processes it as part of its tool invocation chain
- No new message appears in the conversation UI

### Option B: Selective Persistence
Mark as internal but also add to Zep explicitly:
```typescript
const context = {
  userId,
  sessionId,
  userSchema: 'public',
  timezone,
  conversationHistory: [],
  isInternal: true
};

// Also add to Zep for memory retrieval
await zepService.addConversation(userId, userMessage, '', { type: 'interaction_response' });
```

### Option C: Add flag to allow selective persistence
```typescript
const context = {
  userId,
  sessionId,
  userSchema: 'public',
  timezone,
  conversationHistory: [],
  isInternal: true,
  persistToMemory: true  // ← New flag
};
```

## Recommendation
**Option A** is cleanest - just remove `isInternal: true` from interaction response handling. The interaction response is already handled internally and won't duplicate in chat history.

## Files to Change
- `/apps/agents/src/api/interactions.ts` - Remove `isInternal: true` from context

## Related Code
- `/apps/agents/src/agents/base/BaseAgent.ts:138-149` - persistMessage() checks isInternal flag
- `/apps/agents/src/services/ZepMemoryService.ts:198-218` - getUserContext/searchMemory
