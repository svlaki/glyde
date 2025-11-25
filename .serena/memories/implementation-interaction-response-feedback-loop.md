# Interaction Response Feedback Loop Implementation

## Problem Statement
Interactions were being created successfully (agent called `create_interaction` tool), but when users clicked response buttons, nothing happened. The feedback loop was broken because the `respondToInteraction()` endpoint only saved the response to the database without telling the agent to act on it.

## Solution Architecture
Implemented automatic agent invocation when users respond to interactions:

### Flow
1. User clicks interaction button
2. Frontend sends `respondToInteraction()` request with:
   - `interaction_id`: ID of the interaction
   - `response`: User's selected option (e.g., "Yes", "morning", "Confirm")
3. Backend endpoint:
   - Saves response to database
   - Retrieves full interaction context from database
   - Gets ConversationAgent from AgentRegistry
   - Creates AgentContext with user's timezone and session info
   - Calls `conversationAgent.processMessage(context, userMessage)` asynchronously
   - Returns success immediately (doesn't wait for agent)

4. Agent receives message like:
   ```
   User responded to interaction "Would you like to schedule an exercise session for tomorrow?": Yes
   ```
5. Agent can now make decisions based on the response and call tools as needed

### Key Implementation Details

**File: `/apps/agents/src/api/interactions.ts`**

The `respondToInteraction()` function was updated to:

```typescript
export async function respondToInteraction(req: Request, res: Response): Promise<Response | void> {
  // 1. Save response to database
  const saved = await supabaseService.saveInteractionResponse(userId, interactionId, response.trim());

  // 2. Fetch interaction details for context
  const interaction = await supabaseService.getUserInteractionById(interactionId);

  // 3. Get agent from registry
  const agentRegistry = AgentRegistry.getInstance();
  const conversationAgent = agentRegistry.getAgent('conversation');

  if (conversationAgent) {
    // 4. Build context with user's timezone
    const userProfile = await supabaseService.getProfile(userId);
    const context = {
      userId,
      sessionId: `session-${userId}-${Date.now()}`,
      userSchema: 'public',
      timezone: userProfile?.timezone || 'UTC',
      conversationHistory: [],
      isInternal: true // Mark as internal message
    };

    // 5. Call agent asynchronously (non-blocking)
    conversationAgent.processMessage(context, userMessage).catch(error => {
      console.error('Error processing interaction response in agent:', error);
    });
  }

  // 6. Return immediately to frontend
  return res.json({ success: true, message: 'Response saved successfully' });
}
```

### Design Decisions

1. **Asynchronous Processing**: Agent invocation happens in background (`.catch()` error handling). This prevents blocking the frontend while the agent takes actions (especially important if agent makes slow API calls).

2. **Non-blocking Response**: We return success to frontend immediately after saving the response, not waiting for agent completion. This provides instant UI feedback.

3. **AgentContext Construction**:
   - `isInternal: true` - Prevents the interaction response from being persisted as a new conversation message
   - Fresh `conversationHistory: []` - Agents can load full conversation if needed, but this message stands alone
   - Fresh `sessionId` - Each interaction response is a new session context
   - User's real `timezone` - Fetched from profile for accurate time handling

4. **Error Handling**: Errors during agent invocation are logged but don't fail the endpoint. The response was already saved successfully, so we don't want to fail the user's action.

## Testing the Feedback Loop

Test queries that should now trigger interactions AND actions:
- "Should I exercise tomorrow?" → Agent creates interaction → User clicks "Yes" → Agent schedules exercise event
- "When should I do my workout?" → Agent creates multiple choice interaction → User picks "Morning" → Agent creates morning event
- Any query with explicit user response actions

## Integration with System Prompt
The system prompt in `prompts.ts` includes explicit guidance for agents to use `create_interaction` and expect user responses. The agent should understand that when creating an interaction, it will eventually receive feedback via this mechanism.

## Related Files Modified
- `/apps/agents/src/api/interactions.ts` - Updated `respondToInteraction()` function
- `/apps/agents/src/agents/conversation/prompts.ts` - System prompt guidance on interaction usage (from previous update)

## Success Criteria
1. ✅ TypeScript compilation passes
2. ✅ Server starts without errors
3. ✅ Interaction creation still works (verified in previous work)
4. ⏳ User interaction responses now trigger agent actions
5. ⏳ Calendar events/tasks should be created based on interaction responses
