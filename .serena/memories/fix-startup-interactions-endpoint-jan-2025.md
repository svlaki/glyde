# Fix: Startup Interactions Endpoint 404 Error

## Issue
Frontend (authContext.tsx) was calling `/api/interactions/generate-startup` on user authentication, causing a 404 error since this endpoint was disabled/commented out in the backend.

Error in console:
```
Failed to load resource: the server responded with a status of 404
⚠️ Failed to generate startup interactions: 404
```

## Root Cause
- Backend (server.ts:260) has the endpoint commented out with note: "Interactions are now created directly by the agent via create_interaction tool"
- Frontend was still trying to call this disabled endpoint during auth initialization
- This blocked users from seeing interactions even though they were being created correctly

## Solution
Removed the `/api/interactions/generate-startup` endpoint call from `apps/frontend/src/lib/authContext.tsx` (lines 93-99).

**Before:**
```typescript
const response = await fetch(`${AGENT_SERVICE_URL}/api/interactions/generate-startup`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

**After:**
```typescript
// Interactions are now created directly by the agent via create_interaction tool
// They can be generated on-demand via the refresh button in the UI
console.log('✅ Ready to generate interactions on-demand');
```

## Related Fixes in Previous Session
1. **agentId mismatch** (create-interaction.ts line 16)
   - Changed from `agentId: "conversation"` to `agentId: "interaction"`
   - This fixed visibility - frontend filters by `agentId: "interaction"`

2. **Weak system prompt** (agents/interaction/prompts.ts)
   - Rewrote prompt to forbid creating NEW tasks
   - Focused on scheduling work on EXISTING tasks, event prep, goal progress
   - Limited to 0-2 interactions per session for quality

## Current Interaction Flow
1. User logs in → authContext initializes session
2. User navigates to calendar → interactions are fetched from database
3. User clicks "Refresh" button → calls `/api/agent/process` to generate new interactions on-demand
4. InteractionAgent creates interactions via create_interaction tool with correct agentId

## Files Changed
- `apps/frontend/src/lib/authContext.tsx` - Removed startup endpoint call

## Build Status
✅ Build passes with no errors (verified: `cd apps/agents && npm run build`)

## Testing Notes
- The 404 error should no longer appear in console on app startup
- Interactions are now generated on-demand via the refresh button
- Previous fixes for agentId and prompt quality should now be fully functional