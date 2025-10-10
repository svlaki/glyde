# Zep Dual-Graph Memory Architecture - 2025 Implementation

## Overview
Comprehensive refactoring of the Zep memory system to implement a sophisticated dual-graph architecture with custom ontology, user graphs, and centralized group graph for collective intelligence.

## Architecture Components

### 1. **Type Definitions** (`apps/agents/src/types/graph.ts`)
**Custom Entity Types:**
- `CalendarEventEntity`: Events with category, energy level, duration, location
- `TaskEntity`: Tasks with priority, satisfaction ratings, duration tracking
- `GoalEntity`: Goals with progress tracking, deadlines, status
- `TimeBlockEntity`: Preferred time blocks for activities
- `PatternEntity`: Detected behavioral patterns with confidence scores

**Custom Edge Types:**
- `SCHEDULED`: User-event relationship with scheduling metadata
- `COMPLETED_TASK`: Task completion with satisfaction and timing
- `PURSUING_GOAL`: Goal pursuit with progress tracking
- `HAS_PATTERN`: User-pattern relationship with confidence
- `PREFERS`: Time block preferences
- `COMMON_PATTERN`: Cross-user pattern correlations (group graph)

**Constants:**
- `GROUP_GRAPH_ID = 'global_user_patterns'`
- Group graph for shared intelligence across all users

### 2. **ZepGraphService** (`apps/agents/src/services/ZepGraphService.ts`)

**Key Features:**
- ✅ Custom ontology initialization
- ✅ Group graph management
- ✅ User graph operations for calendar, tasks, goals, patterns
- ✅ Unified search across user + group graphs
- ✅ Pattern detection and aggregation
- ✅ Legacy compatibility with existing interfaces

**Core Methods:**

#### Ontology Management
```typescript
initializeOntology(): Promise<void>
// Sets up custom entity and edge types (automatic extraction mode)
```

#### Group Graph
```typescript
initializeGroupGraph(): Promise<void>
addCrossUserPattern(pattern): Promise<void>
searchCommonPatterns(query): Promise<GraphSearchResult>
getRecommendationsFromGroupGraph(context): Promise<string[]>
```

#### User Graph - Calendar
```typescript
addCalendarEventToGraph(userId, event): Promise<void>
searchUserCalendarPatterns(userId, query): Promise<GraphSearchResult>
```

#### User Graph - Tasks
```typescript
addTaskToGraph(userId, task): Promise<void>
analyzeTaskPatterns(userId): Promise<GraphSearchResult>
```

#### User Graph - Goals
```typescript
addGoalToGraph(userId, goal): Promise<void>
searchRelatedGoals(userId, goalType): Promise<GraphSearchResult>
```

#### User Graph - Patterns
```typescript
addDetectedPattern(userId, pattern): Promise<void>
getUserProductivityPatterns(userId): Promise<GraphSearchResult>
```

#### Unified Search
```typescript
searchUnifiedGraphs(userId, query): Promise<{
  userResults: GraphSearchResult;
  groupResults: GraphSearchResult;
}>
```

### 3. **Data Storage Pattern**

**User Graph Example:**
```typescript
await graphService.addCalendarEventToGraph(userId, {
  title: "Team Meeting",
  start_time: "2025-01-15T14:00:00Z",
  end_time: "2025-01-15T15:00:00Z",
  duration_minutes: 60,
  category: "meeting",
  energy_level: "medium",
  location: "Conference Room A",
  attendees: 5
});
```

**Group Graph Example:**
```typescript
await graphService.addCrossUserPattern({
  pattern_type: "peak_productivity_hours",
  description: "Most users are most productive 9-11am",
  frequency: "daily",
  confidence_score: 0.87,
  first_detected: "2025-01-01T00:00:00Z",
  last_observed: "2025-01-15T00:00:00Z",
  user_count: 42
});
```

## Memory Flow Architecture

### Dual-Graph System
```
┌─────────────────────────────────────┐
│  USER GRAPHS (per user)             │
│  - Personal calendar patterns       │
│  - Task completion history          │
│  - Goal progress tracking           │
│  - Individual preferences           │
│  - Behavioral patterns              │
└─────────────────────────────────────┘
          ↓ Analyze & Aggregate
┌─────────────────────────────────────┐
│  GROUP GRAPH (shared)                │
│  - Common productivity patterns      │
│  - Optimal scheduling times          │
│  - Task duration benchmarks          │
│  - Cross-user insights               │
│  - Best practices                    │
└─────────────────────────────────────┘
          ↓ Recommendations
┌─────────────────────────────────────┐
│  AGENTS                              │
│  - User-specific context             │
│  - Group recommendations             │
│  - Personalized intelligence         │
└─────────────────────────────────────┘
```

## Benefits

### 1. **Personalized Intelligence**
- Each user gets temporal knowledge graph of their behavior
- Patterns automatically detected and tracked
- Progress and preferences continuously updated

### 2. **Collective Wisdom**
- All users benefit from aggregate insights
- Common patterns identified across user base
- Recommendations based on successful strategies

### 3. **Temporal Awareness**
- Facts have valid/invalid date ranges
- Information automatically updates as it changes
- Historical context maintained

### 4. **Structured Retrieval**
- Query specific entity types
- Filter by categories, time ranges
- Hybrid semantic + full-text search

### 5. **Scalable Architecture**
- Clean separation of personal vs. shared memory
- Each graph independently queryable
- Parallel search across graphs

## Integration Points

### BaseAgent Integration
```typescript
// Will be implemented in next phase
protected async loadMemoryContext(userId: string): Promise<MemoryContext> {
  const [userContext, groupContext] = await Promise.all([
    this.graphService.getUserProductivityPatterns(userId),
    this.graphService.searchCommonPatterns('productivity scheduling')
  ]);
  
  return combineContexts(userContext, groupContext);
}
```

### Agent Tools (Next Phase)
- `search_user_memory`: Search personal graph
- `search_group_patterns`: Search shared graph
- `add_user_data`: Add structured data to user graph
- `add_pattern`: Add discovered patterns

## Technical Implementation

### API Methods Used
- `client.graph.add()`: Add structured JSON/text data
- `client.graph.search()`: Search with filters and scope
- `client.graph.create()`: Create group graph
- Uses temporal awareness (no manual fact invalidation needed)

### Data Format
```typescript
// Episode data structure
{
  data: JSON.stringify({ event/task/goal/pattern }),
  type: 'json',
  reference_time: new Date()
}
```

### Search Scopes
- `'edges'`: Search relationships/facts
- `'nodes'`: Search entities
- `'episodes'`: Search raw data episodes

## Migration Status

✅ **Phase 1 Complete:**
- Custom ontology types defined
- ZepGraphService fully refactored
- User graph operations implemented
- Group graph operations implemented
- Unified search capabilities
- Legacy compatibility maintained

🔄 **Phase 2 In Progress:**
- Enhanced memory context assembly
- Agent tool integration
- BaseAgent updates

⏳ **Phase 3 Pending:**
- ConversationAgent tool updates
- Full testing and validation
- Documentation finalization

## Files Modified
- `apps/agents/src/types/graph.ts` (NEW)
- `apps/agents/src/services/ZepGraphService.ts` (REFACTORED)
- `apps/agents/src/services/ZepMemoryService.ts` (UNCHANGED - handles threads only)

## Next Steps
1. Update ZepMemoryService.getMemoryContext() to combine user + group + thread data
2. Create agent tools for graph operations
3. Update ConversationAgent with new tools
4. Test with sample data
5. Document usage patterns for agents