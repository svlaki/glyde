# Goal Retrieval Debug Investigation - January 2025

## Problem Report
User reported that the agent cannot retrieve goals - when asking "what are my goals", the agent responds with "no goals" even though goals exist.

## Investigation Findings

### Database Schema
Goals are stored in `public.goals` table with RLS policies. The system previously had multiple goal tables:
- `public.goals` - Current main table (used by agent tools)
- `public.user_goals` - Historical table (may still have data)
- `user_<uuid>.goals` - User schema tables (deprecated)

### Code Flow
1. User asks about goals → ConversationAgent
2. Agent invokes `list_goals` tool
3. Tool calls `SupabaseService.getGoals(userId, filters)`
4. getGoals calls `get_goals_with_categories` RPC function
5. RPC function queries `public.goals WHERE user_id = p_user_id`

### Tool Configuration
- **list-goals tool** (`apps/agents/src/tools/goals/list-goals.ts`):
  - Accesses userId from `config?.configurable?.userId`
  - Calls `getSupabaseService().getGoals(userId, filters)`
  
- **ConversationAgent** (`apps/agents/src/agents/conversation/ConversationAgent.ts`):
  - In `createGraph()` → `executeTools()` function
  - Passes config: `{ configurable: { userId: state.userId, timezone: state.timezone } }`

### Database Function
`get_goals_with_categories(p_user_id UUID)` defined as `SECURITY DEFINER`:
```sql
SELECT ... FROM public.goals g
LEFT JOIN public.categories c ON g.category_id = c.id
WHERE g.user_id = p_user_id
```

### Authorization Setup
- SupabaseService uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- RLS policies on `public.goals`:
  - `FOR SELECT USING (auth.uid() = user_id)`
  - Should not affect service role queries

## Debug Logging Added

### list-goals tool (apps/agents/src/tools/goals/list-goals.ts):
```typescript
console.log('🎯 [LIST-GOALS TOOL] Called with:', {
  userId, status, category, goalType, hasConfig, configKeys
});
console.log('🔍 [LIST-GOALS TOOL] Fetching goals with filters:', filters);
console.log('📊 [LIST-GOALS TOOL] Retrieved goals:', { count, hasGoals });
```

### SupabaseService.getGoals (apps/agents/src/services/SupabaseService.ts):
```typescript
console.log('🔍 [SUPABASE SERVICE] Getting goals for user:', userId, 'with filters:', filters);
console.log('📥 [SUPABASE SERVICE] RPC returned:', {
  dataExists, rawCount, sampleGoal
});
```

## Potential Issues

1. **userId not passed correctly** - Config may not contain userId
2. **Database function returns empty** - RPC might be failing silently
3. **Wrong table** - Goals might be in `user_goals` or user schema tables
4. **RLS issue** - Though unlikely with service role key

## Next Steps

1. **Test with debug logs**:
   - Ask agent about goals
   - Check server logs for debug output
   - Look for userId, goal count, and any errors

2. **Verify database directly**:
   ```sql
   SELECT * FROM public.goals WHERE user_id = '<user_id>';
   SELECT * FROM public.user_goals WHERE user_id = '<user_id>';
   ```

3. **Check goal creation**:
   - Create a new goal via agent
   - Verify it appears in `public.goals`
   - Try listing again

## Files Modified
- `apps/agents/src/tools/goals/list-goals.ts` - Added comprehensive logging
- `apps/agents/src/services/SupabaseService.ts` - Added RPC response logging

## Related Files
- `apps/agents/src/agents/conversation/ConversationAgent.ts` - Tool configuration
- `supabase/migrations/20250105000001_add_category_id_foreign_keys.sql` - get_goals_with_categories function
- `supabase/migrations/20250121_add_category_and_new_tables.sql` - public.goals table creation

## Expected Log Output
When listing goals, should see:
```
🎯 [LIST-GOALS TOOL] Called with: { userId: '...', ... }
🔍 [SUPABASE SERVICE] Getting goals for user: ... with filters: ...
📥 [SUPABASE SERVICE] RPC returned: { dataExists: true, rawCount: N, ... }
📊 [LIST-GOALS TOOL] Retrieved goals: { count: N, hasGoals: true }
```

If userId is missing:
```
🎯 [LIST-GOALS TOOL] Called with: { userId: undefined, ... }
❌ [LIST-GOALS TOOL] Missing userId in config
```

If no goals found:
```
📥 [SUPABASE SERVICE] RPC returned: { dataExists: true, rawCount: 0, ... }
⚠️ [LIST-GOALS TOOL] No goals found
```