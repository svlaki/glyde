# InteractionAgent Scope Constraints Fix

## Problem
InteractionAgent was suggesting interactions for features that don't exist yet:
- Setting reminders/notifications (not implemented)
- General coaching/advice (not actionable)
- Other non-actionable suggestions

This confused users who couldn't act on the suggestions.

## Root Cause
System prompt was too permissive. It said "generate suggestions" without specifying what kinds of suggestions were actually supported.

## Solution Implemented

### 1. Fixed Missing Tool Import & Broken Lookup (CRITICAL)
**Files**: `apps/agents/src/tools/ToolRegistry.ts`

**Issue**: 
- `interactionTools` were never imported
- `getInteractionAgentTools()` tried to look up tools in main registry where they weren't registered
- Agent had ZERO tools available

**Fix**:
- Added import: `import { interactionTools } from './interactions/index.js'`
- Changed `getInteractionAgentTools()` to directly return `interactionTools` instead of trying to look them up

### 2. Constrained System Prompt (BEHAVIOR)
**File**: `apps/agents/src/agents/interaction/prompts.ts`

**Changes**:
- Added explicit ALLOWED SUGGESTION TYPES list:
  - Schedule calendar events
  - Create tasks
  - Set/check goals
  
- Added explicit FORBIDDEN SUGGESTION TYPES list:
  - Reminders/notifications
  - General advice/coaching
  - Non-actionable suggestions
  - Features that don't exist

- Added STRICT RULE: "Only create interactions for actionable items"

## Result
InteractionAgent now:
1. Has access to the create_interaction tool (was broken before)
2. Only suggests things users can actually act on
3. Won't suggest reminders or other unsupported features
4. Maintains clear scope boundaries

## Files Modified
- `apps/agents/src/tools/ToolRegistry.ts` - Import and return interactionTools directly
- `apps/agents/src/agents/interaction/prompts.ts` - Added allowed/forbidden suggestion types

## Testing
Verify InteractionAgent creates interactions only for:
- Calendar events (scheduling)
- Tasks (creating action items)
- Goals (setting/checking progress)

NOT for:
- Reminders
- Notifications
- General advice
- Other unsupported features