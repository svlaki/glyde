# Zep Graph Management Scripts

Quick reference for managing and resetting Zep graphs during development and testing.

## Available Scripts

### 1. Clear Single User Graph (Recommended for Testing)
**Script**: `clear-user-graph.ts`
**Best for**: Testing new memory implementation for a specific user

```bash
# Clear a specific user's graph
tsx apps/agents/src/scripts/clear-user-graph.ts <user-id>

# Example
tsx apps/agents/src/scripts/clear-user-graph.ts 550e8400-e29b-41d4-a716-446655440000
```

**What it does**:
- ✅ Deletes user's Zep graph
- ✅ Clears user's entity mappings from Supabase
- ✅ Deletes user's memory sessions
- ✅ Preserves all other users' data
- ✅ Preserves central community graph

**Perfect for**:
- Testing new `update_memory_advanced` tool
- Debugging individual user memory issues
- Resetting a single user's memory during development

---

### 2. Reset All User Graphs
**Script**: `reset-user-graphs.ts`
**Best for**: Migrating to new Zep implementation for all users

```bash
tsx apps/agents/src/scripts/reset-user-graphs.ts
```

**What it does**:
- ✅ Deletes ALL user graphs from Zep
- ✅ Clears ALL entity mappings from Supabase
- ✅ Preserves central community graph
- ✅ Preserves custom ontology

**Use when**:
- Migrating to new Zep schema
- Resetting all user memory while keeping community patterns
- Fresh start for all users while maintaining shared insights

---

### 3. Quick Zep Cleanup (Nuclear Option)
**Script**: `quick-zep-cleanup.ts`
**Best for**: Complete reset including community data

```bash
tsx apps/agents/src/scripts/quick-zep-cleanup.ts
```

**What it does**:
- ⚠️  Deletes central community graph
- ⚠️  Clears custom ontology
- ⚠️  Note: User graphs persist but will be orphaned

**Use when**:
- Changing Zep ontology structure
- Complete reset including community patterns
- Testing fresh Zep initialization

---

## Getting Your User ID

### From Supabase Dashboard:
1. Go to Supabase Dashboard → Authentication → Users
2. Click on your user
3. Copy the UUID under "UID"

### From SQL:
```sql
-- Get all users
SELECT id, email FROM auth.users;

-- Get your specific user
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

### From Frontend:
```typescript
// In your React app
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

const user = useUser();
console.log('User ID:', user?.id);
```

---

## Testing New Memory Implementation

### Step-by-Step Testing Guide:

1. **Clear your user's graph**:
   ```bash
   tsx apps/agents/src/scripts/clear-user-graph.ts YOUR_USER_ID
   ```

2. **Start a conversation** with the agent

3. **Test update_memory_advanced** by sharing important insights:
   ```
   User: "I've been thinking a lot about this - I really want to prioritize my health over work. I've been working too much."
   ```

4. **Verify the agent uses the tool**:
   - Agent should call `update_memory_advanced`
   - Should set `importance: "high"`
   - Should set `category: "values"`
   - Should use `triggerEarlyPersistence: true`

5. **Test memory retrieval**:
   ```
   User: "What do you know about my priorities?"
   ```

   Agent should call `search_memory_unified` and retrieve the insight.

6. **Test pattern recording**:
   ```
   User: "I always have trouble focusing after lunch, around 2-3pm"
   ```

   Agent should call `manage_patterns` to record this behavioral pattern.

---

## Script Comparison

| Script | User Graphs | Entity Mappings | Central Graph | Ontology | Best For |
|--------|-------------|-----------------|---------------|----------|----------|
| `clear-user-graph.ts` | 1 user only | 1 user only | ✅ Preserved | ✅ Preserved | Testing single user |
| `reset-user-graphs.ts` | All deleted | All deleted | ✅ Preserved | ✅ Preserved | Migration without losing community data |
| `quick-zep-cleanup.ts` | Orphaned | Orphaned | ❌ Deleted | ❌ Cleared | Complete fresh start |

---

## Common Issues & Solutions

### "User not found in Supabase"
- Verify user ID is correct (UUID format)
- Check the user exists in `auth.users` table
- Ensure you're connected to the right Supabase project

### "Error deleting user graph" (404)
- User graph doesn't exist in Zep yet (this is fine!)
- Graph will be auto-created on next conversation

### "Entity mappings not found"
- User hasn't had any calendar/task/goal entities yet
- Mappings are created when user creates events/tasks

### Testing not showing new memory behavior
1. Clear browser cache/local storage
2. Restart the agent server
3. Verify `.env` has correct `ZEP_API_KEY`
4. Check agent logs for tool calls

---

## Safety Tips

⚠️  **Always backup before running scripts**:
```bash
# Backup entity mappings
psql your-db-url -c "COPY entity_graph_mappings TO '/tmp/entity_mappings_backup.csv' CSV HEADER;"
```

⚠️  **Test with a single user first**:
- Use `clear-user-graph.ts` for testing
- Only use `reset-user-graphs.ts` when confident
- `quick-zep-cleanup.ts` is a nuclear option - use sparingly

⚠️  **Remember**:
- Zep graphs auto-reinitialize on next use
- Custom ontology is re-registered automatically
- Community patterns can be rebuilt from user patterns

---

## Development Workflow

**For iterating on memory implementation**:

1. Clear test user's graph:
   ```bash
   tsx apps/agents/src/scripts/clear-user-graph.ts TEST_USER_ID
   ```

2. Make code changes to memory tools

3. Restart agent server

4. Test conversation with new behavior

5. Repeat as needed

**No need to clear graph between code changes** - only clear when you want to reset the user's memory state.

---

## Related Files

- `apps/agents/src/services/ZepGraphService.ts` - Main Zep integration
- `apps/agents/src/tools/memory/` - Memory tools
- `apps/agents/src/types/zep-ontology.ts` - Ontology definitions
- `.serena/memories/zep-reset-scripts-overview` - More detailed docs
