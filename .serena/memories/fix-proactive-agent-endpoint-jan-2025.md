# Fix: Proactive Agent Endpoint (January 2025)

## Problem
Frontend was calling non-existent endpoint `/api/agents/proactive/run` to generate proactive interactions, resulting in 404 errors when user clicked the "Generate Interactions" refresh button in AgentInteractions component.

## Root Cause
- The endpoint `/api/agents/proactive/run` was never implemented in the backend
- Backend has `POST /api/agent/process` which can handle this functionality
- Frontend was incorrectly trying to call a dedicated proactive endpoint that doesn't exist

## Solution
Updated `AgentInteractions.tsx` to use the existing `/api/agent/process` endpoint with proper request payload:

```typescript
const response = await fetch(`${AGENT_SERVICE_URL}/api/agent/process`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    context: {
      userId: user.id,
      sessionId: `interactions-${Date.now()}`,
      timezone: timezone,
      conversationHistory: []
    },
    message: 'Generate 2-3 proactive suggestions based on my calendar, tasks, and goals. Create interactive prompts that I can respond to.',
    targetAgent: 'interaction',
    isInternal: true
  })
})
```

## Key Changes
- **Frontend**: [AgentInteractions.tsx:141-180](apps/frontend/src/components/AgentInteractions.tsx#L141-L180)
  - Changed from calling `/api/agents/proactive/run` to `/api/agent/process`
  - Added proper context payload with userId, sessionId, timezone
  - Set `targetAgent: 'interaction'` to route to InteractionAgent
  - Set `isInternal: true` to prevent storing in chat history

## Endpoints Reference
Backend provides these interaction-related endpoints:
- ✅ `POST /api/interactions/pending` - Fetch pending interactions
- ✅ `POST /api/interactions/respond` - Respond to an interaction
- ✅ `POST /api/interactions/clear` - Clear all interactions
- ✅ `POST /api/agent/process` - Process agent messages (handles proactive generation)
- ❌ `POST /api/interactions/generate-startup` - DISABLED (commented out in server.ts:260)

## Builds
- ✅ `npm run build` in apps/agents: Success
- ✅ `npm run build` in apps/frontend: Success (vite build)

## Testing
The "Generate Interactions" button in the Interactions panel will now:
1. Call `/api/agent/process` with a message requesting proactive suggestions
2. Router to InteractionAgent via `targetAgent: 'interaction'`
3. InteractionAgent generates context-aware interactions using calendar/task/goal data
4. Frontend refetches pending interactions and displays them
