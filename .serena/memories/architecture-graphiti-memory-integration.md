# Graphiti Memory Integration Architecture

## Overview
Successfully integrated Graphiti temporally-aware knowledge graph for enhanced agent memory capabilities. This provides persistent, contextual memory that learns user patterns over time.

## Key Components

### 1. GraphitiMemoryService (Node.js Client)
- **Location**: `apps/agents/src/services/GraphitiMemoryService.ts`
- **Purpose**: Node.js client wrapper for Graphiti Python service
- **Key Methods**:
  - `addEpisode()` - Store user interactions, events, tasks, goals
  - `search()` - Semantic search across knowledge graph
  - `getMemoryContext()` - Get contextual facts for different scenarios
  - `ensureUserNode()` - Create/retrieve user node in graph

### 2. Graphiti Python Service
- **Location**: `services/graphiti/main.py` 
- **Purpose**: FastAPI service providing REST API for Graphiti operations
- **Port**: 8001 (configurable via environment)
- **Dependencies**: Neo4j graph database, graphiti-core package
- **Endpoints**: 
  - `/episodes` - Add new episodes to knowledge graph
  - `/search` - Search for relevant facts
  - `/users/{user_id}/context` - Get contextual memory
  - `/users/{user_id}/node` - Ensure user node exists

### 3. BaseAgent Memory Integration
- **Location**: `apps/agents/src/agents/base/BaseAgent.ts`
- **Changes**: Added Graphiti integration with fallback to basic memory
- **Key Features**:
  - `loadMemoryContext()` - Loads rich context from Graphiti
  - Episode persistence methods for different interaction types
  - Graceful fallback when Graphiti unavailable
  - User node UUID caching for performance

### 4. ConversationAgent Graphiti Tools
- **Location**: `apps/agents/src/agents/conversation/ConversationAgent.ts`
- **New Tool**: `search_memory` - Allows agents to search user's long-term memory
- **Integration**: System prompt updated to use memory search for behavioral insights
- **Use Cases**: Work patterns, preferences, habits, goal tracking

## Episode Types and Memory Storage

### Episode Categories
1. **Conversations**: Chat interactions between user and assistant
2. **Calendar Events**: Event scheduling and management activities  
3. **Task Completion**: Task finishing with energy usage and reflection
4. **Goal Progress**: Goal updates with mood and confidence tracking

### Memory Context Types
- `conversation` - General chat and interaction history
- `task_planning` - Productivity patterns and task management insights
- `goal_coaching` - Personal development and goal achievement context

## Database Schema Updates

### Enhanced User Profiles (Public Schema)
```sql
-- Location: supabase/migrations/20250128000001_enhance_user_profiles_for_agents.sql
ALTER TABLE profile ADD COLUMN:
- values JSONB - Core personal values
- preferences JSONB - User preferences and settings
- work_patterns JSONB - Productivity and work habit insights
- goals_summary TEXT - High-level goals overview
- personality_traits JSONB - Behavioral characteristics
- context_data JSONB - Additional contextual information
```

### Per-User Task/Goal Tables (User Schemas)
```sql
-- Location: supabase/migrations/20250128000002_enhance_task_system.sql
Enhanced fields for tasks and goals:
- energy_required - Energy level needed (low/medium/high)
- estimated_duration - Planned time to complete
- actual_duration - Real time taken
- context_required - Context or resources needed
- completion_notes - Reflection and insights after completion
- archetype - Task category/type for pattern analysis
```

## Integration Patterns

### Memory Loading Pattern
```typescript
// In BaseAgent.loadMemoryContext()
1. Get or cache user node UUID
2. Query Graphiti for contextual facts
3. Load recent events for immediate context  
4. Build comprehensive MemoryContext object
5. Fallback to basic context if Graphiti fails
```

### Episode Persistence Pattern
```typescript
// After agent interactions
await this.persistConversationToMemory(context, userMessage, assistantResponse);
await this.persistTaskCompletionToMemory(userId, taskTitle, completion);
await this.persistGoalProgressToMemory(userId, goalTitle, progress);
```

### Tool-Based Memory Access
```typescript
// ConversationAgent can now search user memory
{
  name: "search_memory",
  description: "Search user's long-term memory and behavioral patterns",
  schema: {
    query: "Search query for user's memory",
    contextType: "conversation | task_planning | goal_coaching"
  }
}
```

## Benefits Achieved

1. **Temporal Awareness**: Agents understand user patterns over time
2. **Contextual Intelligence**: Different memory contexts for different scenarios
3. **Persistent Learning**: User interactions build cumulative knowledge
4. **Behavioral Insights**: Agents can reference work patterns, preferences, habits
5. **Goal Continuity**: Long-term goal tracking with progress awareness
6. **Graceful Degradation**: Fallback when Graphiti service unavailable

## Future Extensions

1. **Pattern Mining Agent**: Analyze user behavior trends from Graphiti data
2. **Goal Coaching Agent**: Leverage goal progress episodes for coaching
3. **Proactive Suggestions**: Use temporal patterns for predictive assistance
4. **Cross-User Insights**: Anonymous pattern aggregation (privacy-preserving)
5. **Multi-Modal Memory**: Integrate visual, audio, and document memories

## Technical Notes

- Memory search tool added to ConversationAgent toolset
- System prompts updated to leverage memory insights
- All TypeScript interfaces updated with Graphiti support
- Error handling includes fallback mechanisms
- Performance optimized with user node UUID caching
- Docker-ready Graphiti service configuration included