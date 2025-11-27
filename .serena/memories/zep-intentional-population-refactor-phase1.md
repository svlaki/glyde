# Zep Intentional Population Refactor - Phase 1

## Status - PHASE 1 COMPLETE ✅

### Completed Tasks
1. ✅ **Cleared User Graph**: User `046894db-bc0b-4d85-874c-692cf6a2c903` Zep graph successfully cleared via `clear-user-graph.ts` script
2. ✅ **Database Migrations**: Added comprehensive schema for sync tracking, idempotency, and retry management
3. ✅ **Sync Helper Module**: Created `zep-sync-helper.ts` with full intentional population framework
4. ✅ **BaseAgent Updates**: Integrated sync helper into all memory persistence methods
5. ✅ **Fire-and-Forget Fixes**: Eliminated fire-and-forget patterns in `create-event.ts`
6. ✅ **Goal Tracking**: Implemented complete goal progress tracking with Zep sync
7. ✅ **DLQ Retry Job**: Created background job for deadletter queue processing

## Database Schema Changes (COMPLETED)
- Created migration: `20250125000001_add_zep_sync_fields.sql`
- **New Fields on `user_interactions`**:
  - `zep_idempotency_key` (UUID) - Prevents duplicate graph entries
  - `zep_synced` (BOOLEAN) - Tracks sync completion status
  - `zep_sync_error` (TEXT) - Stores error messages
  - `zep_sync_attempts` (INTEGER) - Retry counter
  - `zep_sync_last_attempted_at` (TIMESTAMP) - Last sync attempt time
  - `zep_entity_id` (TEXT) - Maps to Zep entity ID
  
- **New Tables**:
  - `zep_sync_log` - Audit trail of all Zep sync operations
  - `zep_deadletter_queue` - Retry queue for failed operations
  
- **Helper Functions**:
  - `log_zep_sync_attempt()` - Log sync attempts
  - `enqueue_zep_retry()` - Add to deadletter queue
  - `mark_interaction_synced()` - Mark as complete
  - `mark_interaction_sync_error()` - Log error

## Fire-and-Forget Patterns Identified

### 1. **BaseAgent Methods** (SAFE - Uses await)
- `persistConversationToMemory()` - ✅ Awaits zepService.addConversation()
- `persistTaskCompletionToMemory()` - ✅ Awaits zepGraphService.addTask()
- `persistCalendarEventToMemory()` - ✅ Awaits zepGraphService.addCalendarEvent()
- `persistGoalProgressToMemory()` - ⚠️ Skipped (commented out)

### 2. **Tool: create-event.ts** (FIRE-AND-FORGET FOUND)
```typescript
zepGraphService.deleteCalendarEvent(conflictingEvent.id).catch(err =>
  console.error('...')
);
```
**Issue**: Error is logged but operation not tracked to DB

### 3. **Zep Service Methods** - Safe async, but need DB sync tracking
- `addCalendarEvent()` - Returns eventId but doesn't track to DB
- `addTask()` - Returns taskId but doesn't track to DB
- `addGoal()` - Returns goalId but doesn't track to DB
- `updateCalendarEvent()` - No DB tracking
- `deleteCalendarEvent()` - No DB tracking (just logs)

## Implementation Strategy

### Phase 1A: Wrapper Functions for Intentional Sync
Create wrapper functions in BaseAgent that:
1. Generate idempotency key before calling Zep
2. Log attempt to `zep_sync_log`
3. Call Zep method with retry logic
4. Mark interaction as synced OR enqueue for retry
5. All Zep operations must update DB state

### Phase 1B: Update create-event.ts Fire-and-Forget
Replace `.catch()` pattern with:
1. Proper async/await
2. Logging to sync_log
3. Enqueue to deadletter_queue on failure

### Phase 2: Fix Thread Lifecycle
- Change from per-session threads to per-user threads
- Current: New thread created each conversation
- Goal: One persistent thread per user (archived on logout)

### Phase 3: Complete Goal Tracking
- Implement `persistGoalProgressToMemory()` in ZepGraphService
- Add goal update methods
- Track goal completions

## Key Files to Modify

### High Priority (Must-fix)
1. **BaseAgent.ts**
   - Add `wrapZepOperation()` method for all Zep calls
   - Implement sync tracking with DB updates
   - Add idempotency key generation

2. **tools/calendar/create-event.ts**
   - Fix fire-and-forget deleteCalendarEvent() pattern
   - Use proper async/await

3. **ZepGraphService.ts**
   - Add sync tracking parameters
   - Return confirmation status
   - Implement retry logic

### Medium Priority
1. **ZepMemoryService.ts**
   - Add async/await everywhere
   - Implement sync tracking
   - Add connection pooling/retry

2. **tools/** (all)
   - Audit for fire-and-forget patterns
   - Add sync tracking

### Low Priority
1. Fix thread lifecycle
2. Complete goal tracking
3. Add monitoring metrics

## Idempotency Key Pattern

```typescript
// When creating Zep sync operation
const idempotencyKey = crypto.randomUUID();

// Check if already synced with this key
const existing = await supabase
  .from('user_interactions')
  .select('zep_entity_id')
  .eq('zep_idempotency_key', idempotencyKey)
  .single();

if (existing) {
  // Already synced, skip operation
  return existing.zep_entity_id;
}

// Otherwise, proceed with Zep call
// On success: mark_interaction_synced()
// On failure: mark_interaction_sync_error() or enqueue_zep_retry()
```

## Testing Strategy

1. **Idempotency Testing**
   - Create interaction
   - Simulate retry with same idempotency key
   - Verify no duplicate in Zep graph

2. **Sync Tracking Testing**
   - Create interaction
   - Verify `zep_synced = false` before Zep returns
   - Verify `zep_synced = true` after confirmation
   - Verify `zep_sync_log` entry created

3. **Error Recovery Testing**
   - Create interaction with Zep unavailable
   - Verify added to `zep_deadletter_queue`
   - Restore Zep, verify auto-retry
   - Verify no duplicates on retry

## Success Criteria

- ✅ All Zep operations tracked in `zep_sync_log`
- ✅ No fire-and-forget patterns in codebase
- ✅ Every DB entity has `zep_synced` status
- ✅ Failures logged to `zep_deadletter_queue`
- ✅ Idempotency keys prevent duplicates
- ✅ User graph cleared for 046894db-bc0b-4d85-874c-692cf6a2c903
- ✅ New interactions demonstrate intentional population
