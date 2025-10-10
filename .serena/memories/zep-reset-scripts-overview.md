# Zep Graph Reset Scripts - Overview

## Available Scripts

### 1. **reset-user-graphs.ts** (NEW - For New Implementation Migration)
**Location:** `apps/agents/src/scripts/reset-user-graphs.ts`

**Purpose:** Reset all user graphs while preserving central graph
- ✅ Keeps central graph intact (community patterns preserved)
- 🗑️ Deletes all user graphs from Zep
- 🗑️ Clears all entity mappings from Supabase
- ✅ Preserves shared intelligence for all users

**Use when:**
- Migrating to new Zep v3 implementation
- Want to reset individual user data but keep community insights
- Testing new user graph structure

**Command:**
```bash
tsx apps/agents/src/scripts/reset-user-graphs.ts
```

---

### 2. **cleanup-zep-graphs.ts** (Full Reset)
**Location:** `apps/agents/src/scripts/cleanup-zep-graphs.ts`

**Purpose:** Complete reset of ALL Zep data
- 🗑️ Deletes central group graph
- 🗑️ Deletes all user graphs
- 🗑️ Clears all entity mappings from Supabase

**Use when:**
- Complete system reset needed
- Starting fresh with new architecture
- Major ontology changes

**Command:**
```bash
tsx apps/agents/src/scripts/cleanup-zep-graphs.ts
```

---

### 3. **quick-zep-cleanup.ts** (Central Graph Only)
**Location:** `apps/agents/src/scripts/quick-zep-cleanup.ts`

**Purpose:** Quick cleanup without Supabase
- 🗑️ Deletes central group graph
- 🗑️ Clears custom ontology
- ⚠️ Does not delete user graphs

**Use when:**
- Testing central graph changes
- No Supabase access available

**Command:**
```bash
ZEP_API_KEY=your_key tsx apps/agents/src/scripts/quick-zep-cleanup.ts
```

---

## Script Comparison Matrix

| Feature | reset-user-graphs | cleanup-zep-graphs | quick-zep-cleanup |
|---------|-------------------|-------------------|-------------------|
| Central Graph | ✅ Preserve | 🗑️ Delete | 🗑️ Delete |
| User Graphs | 🗑️ Delete | 🗑️ Delete | ⚠️ Keep |
| Entity Mappings | 🗑️ Clear | 🗑️ Clear | ⚠️ Keep |
| Needs Supabase | ✅ Yes | ✅ Yes | ❌ No |
| Ontology | ✅ Preserve | ✅ Preserve | 🗑️ Clear |

---

## After Running Scripts

All scripts allow auto-reinitialization:
- Custom ontology will be re-registered (if needed)
- Central graph will be recreated (if deleted)
- Users will be initialized with fresh structure
- Fact rating instructions will be configured

---

## Typical Migration Workflow

1. **Test new implementation:**
   ```bash
   tsx apps/agents/src/scripts/reset-user-graphs.ts
   ```

2. **Verify central graph preserved:**
   - Community patterns still available
   - User graphs start fresh

3. **Run pattern aggregation (optional):**
   ```bash
   tsx apps/agents/src/scripts/run-pattern-aggregation.ts
   ```

4. **Test with users:**
   - Users get initialized automatically on first use
   - Can leverage preserved community insights
