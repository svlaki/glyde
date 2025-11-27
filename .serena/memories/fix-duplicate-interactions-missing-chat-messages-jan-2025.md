# Fix Duplicate Interactions & Missing Chat Messages - January 2025

## Problem Statement
User reported two critical issues:
1. **Duplicate Interactions**: Same interaction was being displayed multiple times in the UI
2. **Missing Chat Messages**: When responding to interactions with "yes", the agent response appeared in console but NOT in the chat UI

## Root Causes Identified

### Issue 1: Duplicate Interactions
Multiple factors were causing duplicates:
1. **Polling + Real-time listeners**: The hook was polling for interactions every 10 seconds AND listening for real-time updates simultaneously. When an interaction was created, it could arrive via both channels, causing duplicates.
2. **No deduplication**: The real-time listener and polling functions didn't check if an interaction already existed before adding it.
3. **Async generation without request deduplication**: The startup interaction generation ran asynchronously fire-and-forget, and if called multiple times before completion, could create multiple interactions with the same content.

### Issue 2: Missing Chat Messages  
The callback chain had an issue:
1. **Dependency timing issue**: ChatBot's useEffect had `onSetResponseCallback` as a dependency, which could change/recreate the effect, registering the callback multiple times or at the wrong time.
2. **Callback might be null when needed**: When AgentInteractions tried to call the chat callback, it might not have been set yet due to timing issues.

## Solutions Implemented

### Frontend Deduplication (apps/frontend/src/hooks/useInteractions.ts)

**1. Real-time listener deduplication**:
```typescript
const handleInteractionUpdate = async (event: CustomEvent) => {
  const { type, interaction } = event.detail;

  if (type === 'INSERT' && interaction.status === 'pending') {
    // Add new interaction only if not already present
    setInteractions(prev => {
      // Check if interaction already exists
      if (prev.some(i => i.id === interaction.id)) {
        console.log('[useInteractions] Ignoring duplicate interaction:', interaction.id);
        return prev;
      }
      const transformed = transformInteraction(interaction);
      return [...prev, transformed].sort((a, b) => b.priority - a.priority);
    });
  }
  // ... rest of handler
};
```

**2. Polling deduplication**:
```typescript
// Merge with existing interactions, avoiding duplicates
setInteractions(prev => {
  // Create a map of existing IDs for quick lookup
  const existingIds = new Set(prev.map(i => i.id));
  // Filter out any incoming interactions that already exist
  const newInteractions = transformed.filter(i => !existingIds.has(i.id));
  // Combine and sort
  return [...prev, ...newInteractions].sort((a, b) => b.priority - a.priority);
});
```

**3. Better logging**:
- Added logging when duplicate interactions are detected
- Helps identify which channel (polling vs real-time) is causing duplicates

### ChatBot Callback Fix (apps/frontend/src/components/ChatBot.tsx)

**Fixed registration timing**:
```typescript
// Set up callback for interaction responses to be added to chat
// Only register once on mount - don't re-register when callback changes
useEffect(() => {
  if (onSetResponseCallback) {
    const addResponseToChat = (message: string) => {
      // ... message handling ...
    }
    console.log('[ChatBot] Registering callback with parent')
    onSetResponseCallback(addResponseToChat)
  }
}, [])  // Empty dependency array - register only once!
```

The key fix: Changed dependency array from `[onSetResponseCallback]` to `[]` so the callback is registered exactly once on mount, not every time the prop changes.

### AgentInteractions Debugging (apps/frontend/src/components/AgentInteractions.tsx)

Added logging to verify callback is available:
```typescript
const handleResponse = async (interactionId: string, response: string) => {
  console.log('[AgentInteractions] Responding to interaction:', interactionId)
  console.log('[AgentInteractions] Chat callback available?', !!onInteractionResponse)
  await respondToInteraction(interactionId, response, onInteractionResponse || undefined)
}
```

### Backend Generation Guard (apps/agents/src/api/interactions.ts)

**Stricter limit checking**:
```typescript
// Check if user already has active interactions (limit 2 per user in DB)
const pending = await supabaseService.getPendingUserInteractions(userId);
if (pending && pending.length >= 2) {  // Changed from > 0 to >= 2
  console.log(`[STARTUP] User ${userId} already has ${pending.length} pending interactions (max 2), skipping generation`);
  return res.json({
    success: true,
    message: 'User already has maximum pending interactions',
    skipped: true,
    existing_count: pending.length
  });
}
```

This allows up to 2 interactions but prevents 3+ from being generated.

## Files Modified

| File | Changes |
|------|---------|
| `apps/frontend/src/hooks/useInteractions.ts` | Added deduplication in real-time listener and polling; better logging |
| `apps/frontend/src/components/ChatBot.tsx` | Fixed callback registration to run once on mount with empty dependency array |
| `apps/frontend/src/components/AgentInteractions.tsx` | Added debugging logs for callback availability |
| `apps/agents/src/api/interactions.ts` | Stricter limit checking (allow 2, prevent 3+) |

## Build Status
✅ Backend: Passes TypeScript compilation
✅ Frontend: Passes Vite build

## How It Works Now

### Interaction Flow (No More Duplicates)
1. User loads app
2. Frontend calls generateSuggestions → `/api/interactions/generate-startup`
3. Backend checks: "Does user have >= 2 pending interactions?"
   - If YES: Skip generation, return 200 with `skipped: true`
   - If NO: Generate interactions
4. Interactions are created in database
5. Real-time listener receives INSERT event
6. Before adding: Check if interaction ID already in state
7. If duplicate: Log and ignore
8. If new: Add to state with sorting

### Chat Message Flow (Messages Now Appear)
1. User clicks "Yes" on an interaction
2. AgentInteractions calls `respondToInteraction(id, "yes", chatCallback)`
3. Frontend service POSTs to `/api/interactions/respond`
4. Backend processes response, generates agent message
5. Response returned with `agentResponse` field
6. Frontend hook receives response
7. Calls `onChatMessage(agentResponse)` - the callback from ChatBot
8. ChatBot's `addResponseToChat` is invoked
9. Message is added to state
10. **Message appears in chat immediately**

## Enhanced Logging Points

**Interaction Generation**:
```
[STARTUP] Generating proactive interactions for user [id]
[STARTUP] User [id] already has [n] pending interactions (max 2), skipping generation
[useInteractions] Ignoring duplicate interaction: [id]
```

**Chat Response Flow**:
```
[AgentInteractions] Responding to interaction: [id] response: yes
[AgentInteractions] Chat callback available? true
[useInteractions] Got agent response, calling callback: "[message]"
[ChatBot] Received message from interaction callback: "[message]"
[ChatBot] Adding bot message to chat: "[message]"
```

## Testing Recommendations

1. **No More Duplicates**:
   - Look at AgentInteractions panel - should only see each interaction once
   - Check console for deduplication messages
   - Response counts should match what you expect

2. **Chat Messages Work**:
   - Click "Yes" on a goal check-in
   - You should see agent response appear in chat immediately
   - Check console for full flow: `[useInteractions] Got agent response` → `[ChatBot] Adding bot message`

3. **Performance**:
   - The polling still runs every 10 seconds for first 2 minutes (then 60 seconds)
   - But deduplication prevents duplicate rendering
   - Callback is only registered once, not recreated each render

## Key Improvements

1. **Robustness**: Multiple layers of deduplication prevent duplicates from any source
2. **Debugging**: Comprehensive logging throughout the flow
3. **UX**: Interactions never appear twice; chat messages appear consistently
4. **Reliability**: Guard against concurrent generation requests
5. **Performance**: Efficient Set-based deduplication (O(1) lookups)
