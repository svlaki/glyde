# Zep Data Flow Mapping - January 2025

## Overview
Complete mapping of what entities are being added to Zep and when, across the entire codebase.

## Data Sink Architecture

There are TWO main services handling Zep sync:

### 1. **ZepMemoryService.ts** - Conversation Memory
- **Purpose**: Store conversation history (user/assistant messages)
- **Storage Location**: Zep Threads (session-based)
- **API Used**: `client.thread.addMessages()`

#### Methods:
- `addUserMessage()` - Adds single user message to thread
- `addAssistantMessage()` - Adds single assistant message to thread  
- `addConversation()` - Adds user + assistant message pair to thread
- **Deprecated** (with warnings):
  - `addCalendarEvent()` - Now use ZepGraphService
  - `addTaskCompletion()` - Now use ZepGraphService
  - `addGoalProgress()` - Now use ZepGraphService

### 2. **ZepGraphService.ts** - Knowledge Graph (Structured Entities)
- **Purpose**: Store structured entity data (events, tasks, goals)
- **Storage Location**: Zep Knowledge Graph (user-scoped nodes)
- **API Used**: `client.graph.add()`
- **Wrapping Helper**: `executeZepOperation()` - With retry/idempotency tracking

#### Methods:
- `addCalendarEvent()` - Adds event node to user's graph
- `addTask()` - Adds task node to user's graph
- `addGoal()` - Adds goal node to user's graph
- `addUserPattern()` - Adds behavior pattern node
- `addCommunityPattern()` - Adds community-level patterns
- `updateCalendarEvent()` - Updates existing event node
- `deleteCalendarEvent()` - Removes event node from graph

---

## Data Flow by User Action

### SCENARIO 1: User Sends Chat Message

**Code Path**: `ConversationAgent.processMessage()`

**Entities Created**:
1. **Zep Thread - User Message** (via `zepService.addUserMessage()`)
   - Single message to conversation thread
   - Content: Raw user message
   - Metadata: timestamp

2. **Zep Thread - Assistant Message** (via `zepService.addAssistantMessage()`)
   - Single message to conversation thread
   - Content: Agent's response
   - Metadata: timestamp, agentType

3. **Graphiti Memory** (via `persistConversationToMemory()` - calls `zepService.addConversation()`)
   - DUPLICATE: Adds both user + assistant messages AGAIN to thread
   - This is a SECOND add of the same messages already added individually above
   - **Result**: Each message pair ends up in thread 2-3 times

**Total Zep Entities Created**: 3-4 messages per user input
- User message (from addUserMessage)
- Assistant message (from addAssistantMessage)
- User message AGAIN (from addConversation)
- Assistant message AGAIN (from addConversation)

**Files Involved**:
- `/apps/agents/src/agents/conversation/ConversationAgent.ts` (lines 65, 106)
- `/apps/agents/src/agents/base/BaseAgent.ts` (lines 132-157) - persistConversationToMemory

---

### SCENARIO 2: Agent Creates Calendar Event

**Code Path**: Tool `createEventTool()` → `supabaseService.createEvent()` + `zepGraphService.addCalendarEvent()`

**Entities Created**:
1. **Supabase Event** (synchronous, blocking)
   - Stored in `public.events` table
   - Returns event with ID

2. **Zep Knowledge Graph - CalendarEvent Node** (async, fire-and-forget)
   - Via `executeZepOperation()` with tracking
   - Data synced: title, category, duration, energy_level, location, attendee_count
   - Wrapped with retry logic (3 attempts)
   - If fails: Enqueued to dead-letter queue for background retry

3. **Optional: Task or Goal** (if agent decides)
   - If agent calls `create_task` tool: Creates Supabase task + Zep Task node
   - If agent calls `create_goal` tool: Creates Supabase goal + Zep Goal node

**Total Zep Entities Created**: 1 CalendarEvent node (+ optional Task/Goal)

**Files Involved**:
- `/apps/agents/src/tools/calendar/create-event.ts` (lines 153-180)
- `/apps/agents/src/tools/tasks/create-task.ts` (lines 34-50)
- `/apps/agents/src/tools/goals/create-goal.ts`
- `/apps/agents/src/utils/zep-sync-helper.ts` - executeZepOperation

---

### SCENARIO 3: Agent Completes a Task

**Code Path**: Tool `completeTaskTool()` → `supabaseService.markTaskComplete()` + Direct Zep Sync

**Entities Created**:
1. **Supabase Task** (status = 'completed')
   - Updated in `public.tasks` table

2. **Zep Knowledge Graph - Task Node** (async, via executeZepOperation)
   - Via `completeTaskTool` calling `zepGraphService.addTask()`
   - Creates/updates task node with completion metadata
   - Wrapped with retry/idempotency (executeZepOperation)

**Total Zep Entities Created**: 1 Task node

**Files Involved**:
- `/apps/agents/src/tools/tasks/complete-task.ts`
- `/apps/agents/src/services/ZepGraphService.ts` - addTask

---

### SCENARIO 4: BaseAgent.persistCalendarEventToMemory() Called

**Code Path**: Called from agent methods (but rarely used directly)

**Entities Created**:
1. **Zep Knowledge Graph - CalendarEvent Node**
   - Via `zepGraphService.addCalendarEvent()`
   - Wrapped with `executeZepOperation()` for retry tracking
   - Data: title, category, duration, energy_level, location, attendees

**Total Zep Entities Created**: 1 CalendarEvent node

**Files Involved**:
- `/apps/agents/src/agents/base/BaseAgent.ts` (lines 246-290)

---

### SCENARIO 5: BaseAgent.persistTaskCompletionToMemory() Called

**Code Path**: Called from agent methods (but rarely used directly)

**Entities Created**:
1. **Zep Knowledge Graph - Task Node**
   - Via `zepGraphService.addTask()`
   - Wrapped with `executeZepOperation()` for retry tracking
   - Data: title, priority, category, duration, energy_required

**Total Zep Entities Created**: 1 Task node

**Files Involved**:
- `/apps/agents/src/agents/base/BaseAgent.ts` (lines 159-202)

---

### SCENARIO 6: BaseAgent.persistGoalProgressToMemory() Called

**Code Path**: Called from agent methods (but rarely used directly)

**Entities Created**:
1. **Zep Knowledge Graph - Goal Node**
   - Via `zepGraphService.addGoal()`
   - Wrapped with `executeZepOperation()` for retry tracking
   - Data: title, goal_type, status, progress_percentage

**Total Zep Entities Created**: 1 Goal node

**Files Involved**:
- `/apps/agents/src/agents/base/BaseAgent.ts` (lines 204-244)

---

### SCENARIO 7: Generating Startup Interactions

**Code Path**: `generateStartupInteractions()` → `ConversationAgent.processMessage()` with internal message

**Entities Created**:
1. **Supabase Interactions** (created by `createInteractionTool`)
   - Stored in `public.user_interactions` table
   - Has metadata about what action to take

2. **Zep Thread Messages** (if agent adds to conversation)
   - User message: "Generate 2-3 proactive suggestions..."
   - Assistant message: The generated suggestions (if added to memory)

3. **Zep Knowledge Graph Nodes** (if suggestions trigger actions)
   - Only if agent internally calls other tools
   - Marked as `isInternal: true` to skip conversation persistence

**Total Zep Entities Created**: Varies based on agent behavior (0-3 messages)

**Files Involved**:
- `/apps/agents/src/api/interactions.ts` (lines 143-214)
- `/apps/agents/src/tools/interactions/create-interaction.ts` - createInteractionTool
- `/apps/agents/src/tools/proactive/analyze-context-for-interactions.ts`

---

### SCENARIO 8: Responding to Interaction

**Code Path**: User responds → `respondToInteraction()` → `ConversationAgent.processMessage()`

**Entities Created**:
1. **Supabase Interaction Response** (stored, blocking)
   - Updates `user_interactions.response_data`
   - Records timestamp of response

2. **Zep Thread Messages** (from agent processing response)
   - User message: "[Interaction response] User's answer"
   - Assistant message: Agent's follow-up (if any)
   - NOT marked as internal, so goes to conversation memory

3. **Zep Knowledge Graph Nodes** (if response triggers actions)
   - Only if agent calls tools based on interaction response
   - Example: "Schedule meeting at 2pm" → Creates CalendarEvent node

**Total Zep Entities Created**: 1-3 messages + optional action nodes

**Files Involved**:
- `/apps/agents/src/api/interactions.ts` (lines 26-116)
- `/apps/agents/src/tools/interactions/create-interaction.ts`

---

## Entity Sync Tracking System

### executeZepOperation() Wrapper
All graph entity creates/updates go through this helper function:

```
User Action
    ↓
Tool calls zepGraphService.addCalendarEvent/Task/Goal
    ↓
Wrapped by executeZepOperation()
    ↓
Logs sync attempt to DB (zep_sync_logs table)
    ↓
Executes with retry logic (3 attempts default)
    ↓
On success: marks as synced (zep_sync_logs.status = 'synced')
    ↓
On failure: enqueues to dead-letter queue (zep_dlq table) for background retry
```

**Tracking Tables**:
- `zep_sync_logs` - Tracks all sync attempts (user_id, entity_type, entity_id, status)
- `zep_dlq` - Dead-letter queue for failed syncs with retry metadata

**Files**:
- `/apps/agents/src/utils/zep-sync-helper.ts` (lines 36-156)

---

## CRITICAL ISSUE: Duplicate Message Persistence

### Problem
In `ConversationAgent.processMessage()`, messages are added THREE times:

1. **Line 65**: `await this.zepService.addUserMessage()` → Adds user message to thread
2. **Line 106**: `await this.zepService.addAssistantMessage()` → Adds assistant message to thread
3. **Lines 122-126**: `await this.persistConversationToMemory()` → Calls `addConversation()` which adds BOTH messages AGAIN

### Result
Each conversation creates 4 Zep messages instead of 2:
- User message x2 (duplicate)
- Assistant message x2 (duplicate)

### Code Location
`/apps/agents/src/agents/conversation/ConversationAgent.ts` lines 65, 106, 122-126

### Recommendation
Choose ONE persistence method:
- **Option A**: Keep individual addUserMessage/addAssistantMessage, REMOVE addConversation
- **Option B**: Remove individual calls, keep addConversation (adds both in one call)
- **Option C**: Have addConversation check if messages already exist before adding

---

## Summary: Entities Created Per User Action

| User Action | Supabase | Zep Threads | Zep Graph | Total |
|---|---|---|---|---|
| Send chat message | 0 | 4 (duplicated) | 0 | 4 |
| Create event via agent | 1 event | 0 | 1 event node | 2 |
| Create task via agent | 1 task | 0 | 1 task node | 2 |
| Create goal via agent | 1 goal | 0 | 1 goal node | 2 |
| Generate startup interactions | 2-3 interactions | 0-2 messages | 0 | 2-5 |
| Respond to interaction | 0 (update existing) | 2 messages | 0 | 2 |
| **Total for typical session** | **~5-10 entities** | **~10-15 messages** | **~3-5 nodes** | **18-30 total** |

---

## Files Summary

### Zep Services
- `/apps/agents/src/services/ZepMemoryService.ts` - Conversation memory
- `/apps/agents/src/services/ZepGraphService.ts` - Knowledge graph structured entities

### Agents
- `/apps/agents/src/agents/base/BaseAgent.ts` - Base persistence methods (persistConversationToMemory, persistCalendarEventToMemory, etc.)
- `/apps/agents/src/agents/conversation/ConversationAgent.ts` - Main conversation loop with message adds

### Tools (Direct Zep Sync)
- `/apps/agents/src/tools/calendar/create-event.ts` - Creates event + graph node
- `/apps/agents/src/tools/calendar/update-event.ts` - Updates graph node
- `/apps/agents/src/tools/calendar/delete-event.ts` - Deletes graph node
- `/apps/agents/src/tools/tasks/create-task.ts` - Creates task + graph node
- `/apps/agents/src/tools/tasks/complete-task.ts` - Updates task in graph
- `/apps/agents/src/tools/goals/create-goal.ts` - Creates goal + graph node
- `/apps/agents/src/tools/goals/update-goal.ts` - Updates goal + graph node
- `/apps/agents/src/tools/interactions/create-interaction.ts` - Creates interaction in DB
- `/apps/agents/src/tools/proactive/analyze-context-for-interactions.ts` - Searches graph for patterns

### Sync Helpers
- `/apps/agents/src/utils/zep-sync-helper.ts` - executeZepOperation wrapper with retry logic
- `/apps/agents/src/jobs/zep-deadletter-retry.ts` - Background job for failed syncs

### API Routes
- `/apps/agents/src/api/interactions.ts` - Interaction endpoints (generateStartupInteractions, respondToInteraction)
- `/apps/agents/src/api/agent.ts` - Main agent chat endpoint