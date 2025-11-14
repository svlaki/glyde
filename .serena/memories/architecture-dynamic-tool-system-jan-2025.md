# Dynamic Tool System Architecture (January 2025)

## Overview
Complete refactoring of the agent tool system to enable dynamic tool management, eliminate manual maintenance, and support hybrid memory persistence.

## Problem Solved
**Before**: Tools were manually maintained in two places:
1. `apps/agents/src/agents/conversation/tools.ts` - Manual array of all tools
2. `apps/agents/src/tools/ToolRegistry.ts` - Separate registration system

**Issues**:
- Adding new tools required updates in 3 places (tool file, index.ts, tools.ts)
- ToolRegistry existed but wasn't used by ConversationAgent
- Memory tools were missing from ToolRegistry
- Tool categorization relied on hardcoded name arrays
- Risk of desynchronization between registry and agent

## Solution Architecture

### 1. Single Source of Truth: ToolRegistry
**File**: `apps/agents/src/tools/ToolRegistry.ts`

**Key Changes**:
- Added memory tools import and registration
- Updated category mapping to include all 28 tools (calendar: 9, tasks: 6, goals: 5, profile: 2, categories: 4, memory: 3, search: 1)
- Serves as the ONLY source of tool definitions

**Tool Categories**:
```typescript
{
  calendar: 9 tools (create, update, delete, bulk, search, list, find-free-time, analyze-schedule, delete-multiple)
  tasks: 6 tools (create, update, delete, list, complete, search)
  goals: 5 tools (create, update, list, check-in, delete)
  profile: 2 tools (get, update)
  categories: 4 tools (create, list, update, delete)
  memory: 3 tools (search-unified, manage-patterns, update-advanced)
  search: 1 tool (web-search)
}
```

### 2. ConversationAgent Integration
**File**: `apps/agents/src/agents/conversation/ConversationAgent.ts`

**Changed**:
```typescript
// OLD: Manual import
import { conversationTools } from './tools.js';

// NEW: Dynamic from registry
import { ToolRegistry } from '../../tools/ToolRegistry.js';
const toolRegistry = ToolRegistry.getInstance();
const tools = toolRegistry.getAllTools();
```

**Benefits**:
- Automatically includes new tools when added to ToolRegistry
- Single line change to add/remove tool categories
- Logs tool count on agent initialization
- No risk of forgetting to register new tools

### 3. New Memory Tool: update_memory_advanced
**File**: `apps/agents/src/tools/memory/update-memory-advanced.ts`

**Purpose**: Hybrid memory persistence approach
- LLM can proactively save breakthrough insights mid-conversation
- Automatic persistence still runs at conversation end (safety net)
- Rich metadata support (importance, category, early persistence trigger)

**Use Cases**:
- User reveals major preferences: "I hate morning meetings"
- Life context changes: "Starting new job next month"
- Value shifts: "I want to prioritize health over work"
- Significant behavioral patterns discovered

**Schema**:
```typescript
{
  insights: string[],              // Key facts to persist
  importance: "low" | "medium" | "high",
  category: string,                // e.g., "preferences", "goals", "patterns"
  triggerEarlyPersistence: boolean, // Save immediately vs batch at end
  metadata?: Record<string, any>   // Additional context
}
```

### 4. Enhanced Prompts with Memory Guidance
**File**: `apps/agents/src/agents/conversation/prompts.ts`

**Changes**:
1. Added `toolCount?: number` to PromptContext interface
2. Dynamic tool count injection in system prompt
3. Comprehensive MEMORY MANAGEMENT section with:
   - When to use each of 3 memory tools
   - Importance levels explanation
   - Example workflow for memory persistence
4. Architecture notes about tool loading

**Memory Tool Guidance**:
- `search_memory_unified`: Recall existing memories and patterns
- `manage_patterns`: Record recurring behavioral patterns
- `update_memory_advanced`: Proactively save important insights (NEW)

### 5. Deleted Files
- `apps/agents/src/agents/conversation/tools.ts` - No longer needed, functionality moved to ToolRegistry

## Why Prompts.ts Remains Separate

**Architectural Benefits**:
1. **Single Responsibility**: ConversationAgent handles graph orchestration, prompts.ts handles prompt construction
2. **Testability**: Can unit test `buildSystemPrompt()` with mock contexts independently
3. **Reusability**: Other agents can import and extend `buildSystemPrompt()`
4. **Maintainability**: 200-line prompt extracted from 300-line createGraph method
5. **Type Safety**: PromptContext interface enforces required data

**Future Enhancement Opportunity**:
- Generate tool usage documentation dynamically from ToolRegistry metadata
- Keep behavioral instructions static, make tool listings dynamic
- Add tool.category and tool.priority metadata to tool definitions

## Migration Guide

### Adding New Tools (New Pattern)
**Before** (3 places to update):
1. Create tool in `apps/agents/src/tools/category/new-tool.ts`
2. Export from `apps/agents/src/tools/category/index.ts`
3. Manually add to `apps/agents/src/agents/conversation/tools.ts` array

**After** (2 places):
1. Create tool in `apps/agents/src/tools/category/new-tool.ts`
2. Export from `apps/agents/src/tools/category/index.ts` in the category array

ToolRegistry automatically picks it up via category imports!

### Removing Tools
Simply remove from category index.ts export array. No changes needed elsewhere.

### Creating New Tool Categories
1. Create `apps/agents/src/tools/new-category/index.ts`
2. Export `newCategoryTools` array
3. Import in ToolRegistry and add to `registerDefaultTools()`
4. Add category to `getToolsByCategory()` type union and mapping

## Testing Verification

After implementation, verify:
```bash
# Should log: "🔧 [CONVERSATION AGENT] Loaded 28 tools from ToolRegistry"
# Should include: "You have access to 28 specialized tools"
```

Check tools are accessible:
```typescript
const registry = ToolRegistry.getInstance();
console.log(registry.getToolCount()); // Should be 28
console.log(registry.getToolsByCategory('memory')); // Should return 3 tools
console.log(registry.hasTool('update_memory_advanced')); // Should be true
```

## Impact

**Developer Experience**:
- ✅ 33% less places to update when adding tools (3 → 2)
- ✅ Automatic tool registration, no manual tracking needed
- ✅ Type-safe category system
- ✅ Centralized tool management

**Agent Capabilities**:
- ✅ 28 total tools (was 27)
- ✅ Proactive memory management
- ✅ Better insight preservation
- ✅ Dynamic tool discovery

**Code Quality**:
- ✅ Eliminated duplicate tool arrays
- ✅ Single source of truth pattern
- ✅ Better separation of concerns
- ✅ Clearer architecture documentation

## Related Files

**Core**:
- `apps/agents/src/tools/ToolRegistry.ts` - Central tool registry (MODIFIED)
- `apps/agents/src/agents/conversation/ConversationAgent.ts` - Agent using registry (MODIFIED)
- `apps/agents/src/agents/conversation/prompts.ts` - Enhanced prompts (MODIFIED)

**Memory Tools**:
- `apps/agents/src/tools/memory/index.ts` - Memory tool exports (MODIFIED)
- `apps/agents/src/tools/memory/update-memory-advanced.ts` - New tool (CREATED)
- `apps/agents/src/tools/memory/search-memory-unified.ts` - Existing
- `apps/agents/src/tools/memory/manage-patterns.ts` - Existing

**Deleted**:
- `apps/agents/src/agents/conversation/tools.ts` - Replaced by ToolRegistry

## Future Enhancements

1. **Tool Metadata System**:
   - Add `category`, `description`, `priority`, `version` to each tool
   - Enable automatic categorization without hardcoded name arrays
   - Generate tool documentation from metadata

2. **Dynamic Prompt Generation**:
   - Auto-generate tool usage examples from metadata
   - Context-aware tool filtering (only show relevant tools)
   - Tool version compatibility checking

3. **Tool Discovery Pattern**:
   - Auto-scan tool directories for new tools
   - Validate tool schemas on registration
   - Better error messages for missing/invalid tools

4. **Advanced Memory Integration**:
   - Implement queued insights batch processing
   - Session metadata for pending memory updates
   - Memory update analytics and insights