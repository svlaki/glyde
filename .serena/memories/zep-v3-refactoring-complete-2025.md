# Zep v3 Refactoring - Complete Implementation (2025)

## 🎯 Overview
Successfully refactored Zep integration to leverage full v3 capabilities with:
- Custom ontology registration
- Dual-graph architecture (user + central graphs)
- Fact rating system for quality filtering
- Hybrid BM25 + semantic search
- Pattern aggregation pipeline for collective intelligence

## ✅ What Was Implemented

### 1. **Custom Ontology Registration** (`apps/agents/src/services/ZepGraphService.ts`)

**Entity Types (6):**
- `CalendarEvent`: Events with category, energy level, duration, location
- `Task`: Tasks with priority, satisfaction ratings, duration tracking
- `Goal`: Goals with progress tracking, deadlines, status
- `Pattern`: Behavioral patterns with confidence scores
- `TimeBlock`: Preferred time blocks for activities
- `UserPreference`: User preferences and settings

**Edge Types (6):**
- `SCHEDULED`: User → CalendarEvent (with attendance status, reschedule count)
- `COMPLETED_TASK`: User → Task (with satisfaction, completion time)
- `PURSUING_GOAL`: User → Goal (with progress, momentum)
- `HAS_PATTERN`: User → Pattern (with observation count, strength)
- `PREFERS_TIME`: User → TimeBlock (with adherence rate)
- `COMMON_PATTERN`: Pattern → Pattern (cross-user correlations in central graph)

**Implementation:**
```typescript
// ZepGraphService constructor automatically calls:
await this.client.graph.set_ontology({
  entities: { CalendarEvent, Task, Goal, Pattern, TimeBlock, UserPreference },
  edges: { SCHEDULED, COMPLETED_TASK, PURSUING_GOAL, HAS_PATTERN, PREFERS_TIME, COMMON_PATTERN }
});
```

### 2. **Central Group Graph** (`CENTRAL_GRAPH_ID = "central_user_patterns"`)

**Purpose:** Store cross-user patterns and collective intelligence

**Created automatically on service initialization:**
```typescript
await this.client.graph.create({
  graph_id: CENTRAL_GRAPH_ID,
  name: "Global User Intelligence",
  description: "Centralized knowledge graph for cross-user patterns, insights, and collective intelligence"
});
```

**Operations:**
- `addCommunityPattern()`: Add validated cross-user patterns
- `searchCommunityPatterns()`: Search for community insights (min 3 users by default)
- Pattern aggregation via `PatternAggregationService`

### 3. **Fact Rating System**

**User Initialization with Ratings:**
```typescript
await this.client.user.add({
  user_id: userId,
  fact_rating_instruction: {
    instruction: `Rate facts by confidence and relevance:
- Pattern facts: 0.8-1.0 = strong pattern (15+ observations)
- Event facts: 0.6-0.9 = verified events
- Goal facts: 0.7-1.0 = active goals with progress
- Preference facts: 0.5-1.0 = validated preferences`,
    examples: {
      high: "User completes deep work at 9am every weekday (observed 15 times, 95% consistency)",
      medium: "User prefers afternoon meetings (observed 8 times, 70% adherence)",
      low: "User tried morning exercise once (observed 1 time, 30% confidence)"
    }
  }
});
```

**Usage in Search:**
```typescript
// Only return high-quality patterns (0.7+ rating)
await graphService.searchHighQualityPatterns(userId, query);

// Filter by custom rating threshold
await graphService.searchUserGraphAdvanced(userId, query, {
  minRating: 0.6,
  edgeTypes: ['HAS_PATTERN']
});
```

### 4. **Hybrid BM25 + Semantic Search**

**Advanced Search Method:**
```typescript
async searchUserGraphAdvanced(userId, query, {
  reranker: 'rrf',           // Reciprocal Rank Fusion (hybrid BM25 + semantic)
  minRating: 0.7,            // Fact quality threshold
  entityTypes: ['Pattern'],   // Filter by entity type
  edgeTypes: ['HAS_PATTERN'], // Filter by edge type
  scope: 'edges'             // Search edges/nodes/episodes
}): Promise<GraphSearchResult>
```

**Features:**
- **Semantic similarity**: Vector embeddings for conceptual matches
- **BM25 full-text**: Keyword-based exact matching
- **RRF reranking**: Combines both for optimal relevance
- **Temporal filtering**: Filter by valid_at, invalid_at timestamps
- **Type filtering**: Search specific entities/edges

### 5. **Enhanced Memory Context Assembly**

**Unified Context Method:**
```typescript
async getEnhancedUserContext(userId: string, sessionId: string): Promise<MemoryContext> {
  // 1. Thread-based context (recent conversations)
  const threadContext = await this.client.memory.get({ session_id: sessionId, min_fact_rating: 0.5 });
  
  // 2. User graph patterns (personal behavioral patterns)
  const userPatterns = await this.searchHighQualityPatterns(userId, 'productivity scheduling preferences goals habits');
  
  // 3. Community insights (cross-user patterns from central graph)
  const communityInsights = await this.searchCommunityPatterns('productivity peak hours scheduling best practices', 5);
  
  // 4. Combine into comprehensive context
  return {
    facts: threadContext.facts,
    memory_context: `${threadContext.memory_context}
    
**Your Personal Patterns:**
${userPatterns.edges.map(e => `- ${e.fact.description} (${e.fact.confidence_score} confidence)`).join('\n')}

**Community Insights (What Works for Others):**
${communityInsights.join('\n')}`,
    entities: threadContext.entities
  };
}
```

### 6. **Pattern Aggregation Pipeline** (`apps/agents/src/services/PatternAggregationService.ts`)

**Purpose:** Automatically discover and aggregate cross-user patterns

**Process:**
1. Fetch all users from Supabase
2. Collect patterns from each user graph (min 0.6 rating)
3. Aggregate by pattern_type across users
4. Filter community patterns (min 3 users, min 0.6 avg confidence)
5. Add validated patterns to central graph

**Run via:**
```typescript
const service = new PatternAggregationService();
const result = await service.aggregateAllUserPatterns({
  minUsers: 3,       // Minimum users for community pattern
  minConfidence: 0.6 // Minimum average confidence
});
```

**Should be scheduled:** Daily or weekly cron job

### 7. **Updated Memory Tools** (`apps/agents/src/tools/memory/`)

**search-user-memory.ts:**
- Uses `ZepGraphService.getEnhancedUserContext()`
- Returns user patterns + community insights
- Filters by fact rating threshold

**search-group-patterns.ts:**
- Searches central graph for community patterns
- Returns formatted insights with user count and confidence
- Minimum user threshold configurable

**search-user-graph.ts:**
- Direct user graph search with advanced filters
- Supports entity/edge type filtering

**add-user-pattern.ts:**
- Adds detected patterns to user graph
- Uses `ZepGraphService.addUserPattern()`

**add-community-pattern.ts:**
- Adds validated patterns to central graph
- Uses `ZepGraphService.addCommunityPattern()`

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────┐
│  ZEP V3 DUAL-GRAPH ARCHITECTURE         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────┐
│  USER GRAPHS (per user)             │
│  ✓ Personal calendar patterns       │
│  ✓ Task completion history          │
│  ✓ Goal progress tracking           │
│  ✓ Individual preferences           │
│  ✓ Behavioral patterns              │
│  ✓ Fact ratings (0.0-1.0)           │
└─────────────────────────────────────┘
          ↓ Pattern Aggregation Service
┌─────────────────────────────────────┐
│  CENTRAL GRAPH (shared)              │
│  ✓ Common productivity patterns      │
│  ✓ Optimal scheduling times          │
│  ✓ Task duration benchmarks          │
│  ✓ Cross-user insights               │
│  ✓ Best practices (3+ users)         │
└─────────────────────────────────────┘
          ↓ getEnhancedUserContext()
┌─────────────────────────────────────┐
│  AGENTS                              │
│  ✓ User-specific context             │
│  ✓ Community recommendations         │
│  ✓ Hybrid BM25 + semantic search     │
│  ✓ Fact quality filtering            │
└─────────────────────────────────────┘
```

## 🔑 Key Features Enabled

### 1. **Collective Intelligence**
- Every user benefits from insights across entire user base
- Common patterns automatically discovered and shared
- Best practices emerge organically from aggregated data

### 2. **Temporal Awareness**
- Facts have valid_at/invalid_at timestamps
- Automatic fact invalidation when behaviors change
- Point-in-time queries possible

### 3. **Quality Filtering**
- Fact ratings ensure only validated patterns used
- Configurable thresholds per query
- High-confidence facts prioritized

### 4. **Advanced Search**
- Hybrid BM25 + semantic for better relevance
- Entity and edge type filtering
- Temporal range queries
- Breadth-first search from user node

### 5. **Scalable Architecture**
- Clean separation: user graphs vs central graph
- Each graph independently queryable
- Parallel aggregation for performance
- Privacy-conscious (individual data stays in user graphs)

## 🚀 Usage Examples

### Add Calendar Event to User Graph:
```typescript
const graphService = new ZepGraphService();
await graphService.addCalendarEvent(userId, {
  title: "Team Meeting",
  category: "meeting",
  duration_minutes: 60,
  energy_level: "medium",
  location: "Conference Room A",
  attendee_count: 5
});
```

### Search User Patterns:
```typescript
const patterns = await graphService.searchHighQualityPatterns(
  userId,
  "productivity peak hours morning focus"
);
```

### Get Community Insights:
```typescript
const insights = await graphService.searchCommunityPatterns(
  "optimal meeting times scheduling",
  5 // min 5 users
);
// Returns: ["Most users prefer morning meetings 9-11am (12 users, 0.85 confidence)", ...]
```

### Get Enhanced Context for Agent:
```typescript
const context = await graphService.getEnhancedUserContext(userId, sessionId);
// Includes: thread context + user patterns + community insights
```

### Run Pattern Aggregation:
```typescript
import { runPatternAggregation } from './services/PatternAggregationService.js';
await runPatternAggregation(); // Should be cron job
```

## 📁 Files Modified/Created

### Core Services:
- ✅ `apps/agents/src/services/ZepGraphService.ts` - Complete refactor with v3 features
- ✅ `apps/agents/src/services/PatternAggregationService.ts` - NEW: Pattern aggregation pipeline
- ✅ `apps/agents/src/types/zep-ontology.ts` - Custom ontology definitions (already existed, now used)

### Memory Tools:
- ✅ `apps/agents/src/tools/memory/search-user-memory.ts` - Updated to use getEnhancedUserContext()
- ✅ `apps/agents/src/tools/memory/search-group-patterns.ts` - Updated to use searchCommunityPatterns()
- ✅ `apps/agents/src/tools/memory/search-user-graph.ts` - Already using new service
- ✅ `apps/agents/src/tools/memory/add-user-pattern.ts` - Already using addUserPattern()
- ✅ `apps/agents/src/tools/memory/add-community-pattern.ts` - Already using addCommunityPattern()

## 🔄 Migration from Old to New

### Before (Disabled):
```typescript
// All methods just logged "Graphiti disabled" and returned empty
async addCalendarEvent() {
  console.log("Graphiti disabled - skipping");
  return '';
}
```

### After (Fully Functional):
```typescript
// Uses graph.add() with custom ontology
async addCalendarEvent(userId, event) {
  await this.client.graph.add({
    user_id: userId,
    ...formatEntityForGraph('CalendarEvent', event)
  });
}
```

## 🎯 Next Steps (Future Enhancements)

1. **Scheduled Jobs:**
   - Set up daily/weekly cron for `runPatternAggregation()`
   - Monitor central graph size and performance

2. **Additional Tools:**
   - `temporal-query-tool`: Point-in-time pattern queries
   - `pattern-analysis-tool`: Analyze pattern evolution over time
   - `benchmark-tool`: Compare user metrics vs community
   - `recommendation-tool`: Get AI suggestions from central graph

3. **Optimization:**
   - Cache frequently accessed community patterns
   - Implement pagination for large result sets
   - Add GraphQL interface for complex queries

4. **Analytics:**
   - Dashboard showing community pattern growth
   - User engagement metrics with patterns
   - Pattern confidence evolution tracking

## ⚙️ Configuration

### Environment Variables:
- `ZEP_API_KEY` - Required for Zep Cloud access
- `NEXT_PUBLIC_SUPABASE_URL` - For user data access
- `SUPABASE_SERVICE_ROLE_KEY` - For pattern aggregation

### Constants:
- `CENTRAL_GRAPH_ID = "central_user_patterns"` (in zep-ontology.ts)
- Minimum users for community pattern: 3 (configurable)
- Fact rating threshold: 0.5-0.7 (configurable per query)

## 🔗 Related Documentation

- Zep v3 Docs: https://docs.getzep.com/
- Custom Ontology: https://docs.getzep.com/customizing-graph-structure
- Fact Ratings: https://docs.getzep.com/facts
- Graph Search: https://docs.getzep.com/searching-the-graph
