# Refactor: LLM-Controlled Interactions (Removed Hard-Coded Generation)

## Overview
Removed hard-coded interaction generation logic and replaced with flexible LLM-controlled system. The agent now has full control over WHEN and WHAT interactions to create.

## Changes Made

### 1. Tool Registry Updates
**File**: `apps/agents/src/tools/ToolRegistry.ts`
- Removed import of `proactiveTools`
- Removed registration of `analyzeContextForInteractions` tool (line 74)
- Removed 'proactive' from type unions in `getToolsByCategory` and `getToolNames` methods
- Removed `analyze_context_for_interactions` from categoryPrefixes object

### 2. Conversation Agent Prompts
**File**: `apps/agents/src/agents/conversation/prompts.ts`
- **Removed**: Hard-coded workflow referencing `analyze_context_for_interactions`
- **Added**: Flexible `create_interaction` documentation
- Agent now decides WHEN and WHAT interactions to create
- Updated prompt to explain:
  - `create_interaction` is available for any interactive prompt
  - Agent defines question, options, priority, and metadata
  - Metadata can include action details that execute on user response

### 3. Disabled Auto-Generation Endpoint
**File**: `apps/agents/src/api/server.ts`
- Commented out `/api/interactions/generate-startup` endpoint
- Removed unused import of `generateStartupInteractions`

### 4. Updated Frontend Service
**File**: `apps/frontend/src/lib/interactions/interactionService.ts`
- Modified `generateSuggestions()` method
- Now calls `/api/agent/process` directly instead of disabled endpoint
- Sends message: "Generate some personalized suggestions or interactions based on my calendar, tasks, and goals"
- Agent will create interactions via `create_interaction` tool as needed
- Uses `isInternal: true` to prevent suggestion requests from appearing in chat

## Key Behavioral Changes

### Before
- Hard-coded interaction types (goal progress checks, etc.)
- `analyze_context_for_interactions` tool generated pre-formatted suggestions
- Agent had to follow specific workflow to convert suggestions to interactions
- Limited flexibility in interaction content/structure

### After
- Agent has complete control over interaction creation
- Can create any type of interaction (yes/no, multiple choice, confirmation)
- Can define custom metadata for action workflows
- Flexible timing - create when appropriate vs automatic generation
- Agent decides question wording, options, priority, and metadata

## How It Works Now

1. **User clicks "Generate" button** or agent decides to create suggestions
2. **Frontend** calls `/api/agent/process` with message about generating suggestions
3. **Agent** analyzes calendar/tasks/goals and decides what interactions to create
4. **Agent** calls `create_interaction` tool directly with:
   - `question`: Custom question text
   - `type`: yes_no, multiple_choice, or confirmation
   - `options`: Array of option strings (if applicable)
   - `priority`: 1-5 importance level
   - `metadata`: Custom metadata for action execution
5. **Interactions** appear in UI panel, users respond
6. **Agent** receives response with metadata and executes actions

## Files NOT Changed (Still Work As-Is)
- Frontend UI components (`AgentInteractions.tsx`, `useInteractions` hook)
- Interaction response handling (`/api/interactions/respond`)
- Database schema and real-time listeners
- Category and other tool systems

## Files Modified Summary
1. `apps/agents/src/tools/ToolRegistry.ts` - Removed proactive tool registration
2. `apps/agents/src/agents/conversation/prompts.ts` - Updated agent instructions
3. `apps/agents/src/api/server.ts` - Disabled startup endpoint
4. `apps/frontend/src/lib/interactions/interactionService.ts` - Updated generateSuggestions

## Result
✅ Complete LLM control over interaction creation
✅ No more hard-coded suggestion logic
✅ Flexible interaction types and metadata
✅ Agent decides when/what to create
✅ Interactions UI remains unchanged
