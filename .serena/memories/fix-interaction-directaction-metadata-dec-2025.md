# Fix: InteractionAgent Prompt - Explicit DirectAction Metadata Rules

## Problem
Agent was creating interactions with wrong action type (update_task instead of create_event) because system prompt wasn't explicit enough about when to use which action type.

Example failure:
- User context: "Schedule time to work on ICCA set"
- Agent created: `metadata.directAction.type: "update_task"` with no taskId
- Result: Error "taskId and taskData required for update_task action"

## Solution Implemented

### File: `apps/agents/src/agents/interaction/prompts.ts`

#### Updated Sections:

**1. TEMPLATE FOR YES_NO INTERACTIONS (Lines 65-82)**
Shows exact metadata structure for work/prep suggestions:
```json
{
  "action": "suggestion",
  "context": "reason why",
  "directAction": {
    "type": "create_event",
    "eventData": {
      "title": "[TASK/EVENT NAME] - Focus Time",
      "duration": 60,
      "description": "Dedicated time to work on [task/prepare for event]",
      "startTime": null,
      "categoryId": null
    }
  }
}
```

**2. RULES FOR DIRECTACTION (Lines 84-91)**
Explicit rules for action type selection:
- ALWAYS use "create_event" for suggesting work time or prep time
- NEVER use "update_task" unless you have the specific task ID
- NEVER use "create_task" for suggestions (only suggest working on EXISTING tasks)
- startTime: Leave as null or use ISO format if known specific time
- duration: Always in MINUTES (60 = 1 hour, not 60 seconds)
- categoryId: Leave as null

**3. EXAMPLE CORRECT METADATA (Lines 93-107)**
Concrete example following the template:
```json
{
  "action": "suggestion",
  "context": "CS221 Problem Set is due tomorrow",
  "directAction": {
    "type": "create_event",
    "eventData": {
      "title": "CS221 Problem Set - Focus Time",
      "duration": 60,
      "description": "Work on CS221 Problem Set due Dec 4",
      "startTime": null,
      "categoryId": null
    }
  }
}
```

## Impact
✅ Agent now has explicit keywords and rules to choose correct action types
✅ TEMPLATE shows exact structure to follow
✅ RULES section removes ambiguity about when to use which action
✅ EXAMPLE provides concrete template to follow

## Critical Fix: Agent Not Passing Metadata Parameter (Dec 1, 2025)

**Problem**: Agent was calling create_interaction without the metadata parameter, so directAction wasn't being saved.

**Root Cause**: Prompt showed example metadata structure but didn't explicitly tell agent to PASS it as a parameter to the tool.

**Solution**: Updated prompt to be extremely explicit:
- Lines 65-68: Added "CRITICAL INSTRUCTIONS FOR CALLING create_interaction" explicitly stating agent MUST pass metadata parameter
- Line 70: Changed to "TEMPLATE FOR YES_NO INTERACTIONS (Copy this structure exactly)"
- Lines 99-118: Changed example to show actual function call syntax showing metadata as parameter
- Lines 120-125: Updated execution rules to emphasize "EVERY call to create_interaction MUST include metadata"

**Key Changes**:
- From: "metadata: {...}" (showing structure)
- To: "create_interaction(..., metadata: {...})" (showing it as parameter)

## Build Status
✅ `npm run build` succeeds in apps/agents
✅ Frontend build succeeds with no TypeScript errors

## Testing Required (After Prompt Update)
1. Generate interactions with "Generate Proactive Interactions" button
2. Verify in database/logs that metadata.directAction is being passed
3. Verify metadata.directAction.type is "create_event" (not missing, not "update_task")
4. Click "Yes" and verify event is created without errors
5. Check backend logs for "Event created: [event-id]"
6. Check that duration is properly converted to minutes (60 = 1 hour)