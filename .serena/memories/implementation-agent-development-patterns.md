# Agent Development Patterns

## Established Patterns for Building AI Agents

### 1. BaseAgent Architecture Pattern
- **Location**: `apps/agents/src/agents/base/BaseAgent.ts`
- **Pattern**: Abstract base class with shared utilities
- **Key Features**:
  - Standardized memory loading with Graphiti integration
  - Common tool registration and invocation methods
  - Episode persistence for different interaction types
  - Graceful fallback mechanisms for service failures

### 2. LangGraph State Management Pattern
```typescript
// Define state with Annotation for reducer logic
const ConversationState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),
  userId: Annotation<string>(),
  pendingActions: Annotation<any[]>({
    reducer: (_existing, update) => update,
    default: () => [],
  }),
});
```

### 3. Tool Definition Pattern
```typescript
const toolName = tool(
  async ({ param1, param2 }) => {
    return `Tool execution result: ${JSON.stringify({ param1, param2 })}`;
  },
  {
    name: "tool_name",
    description: "Clear description of what the tool does",
    schema: z.object({
      param1: z.string().describe("Description of parameter"),
      param2: z.enum(["option1", "option2"]).describe("Enum parameter"),
    }),
  }
);
```

### 4. Workflow Node Pattern
```typescript
// Separate concerns into distinct workflow nodes
const callModel = async (state: StateType) => {
  // Load context, prepare system message, invoke LLM
};

const executeTools = async (state: StateType) => {
  // Handle tool calls, return tool results
};

const executeActualOperations = async (state: StateType) => {
  // Perform actual system operations based on tool calls
};
```

### 5. Memory Context Pattern
```typescript
// Rich memory context with multiple layers
interface MemoryContext {
  shortTerm: { sessionId, messages, context, lastUpdated };
  longTerm: { userId, profile, preferences, goals, insights };
  entity: { entities, relationships };
  vector: { recentEvents, recentChats, semanticContext };
  graphiti?: { userNodeUuid, contextType, totalFacts, relevantFacts };
}
```

### 6. Service Integration Pattern
```typescript
class Agent extends BaseAgent {
  constructor() {
    this.supabaseService = new SupabaseService();
    this.embeddingService = new EmbeddingService();
    this.graphitiService = new GraphitiMemoryService();
  }
  
  // Use services with error handling
  try {
    const result = await this.graphitiService.search(userId, query);
  } catch (error) {
    console.warn('Service failed, using fallback:', error);
    // Implement fallback logic
  }
}
```

### 7. Episode Persistence Pattern
```typescript
// Different episode types for different interactions
await this.persistConversationToMemory(context, userMessage, response);
await this.persistTaskCompletionToMemory(userId, task, completion);
await this.persistCalendarEventToMemory(userId, event, details);
await this.persistGoalProgressToMemory(userId, goal, progress);
```

### 8. Tool Execution Switch Pattern
```typescript
switch (action.name) {
  case "tool_name":
    try {
      // Validate inputs
      // Perform operation
      // Handle success/failure
      result = `✅ Operation successful`;
    } catch (error) {
      result = `❌ Error: ${error.message}`;
    }
    break;
    
  default:
    result = `❌ Unknown action: ${action.name}`;
}
```

### 9. System Prompt Structure Pattern
```typescript
const systemMessage = new SystemMessage(`
ROLE: You are an intelligent [specific role]

CONTEXT: 
${contextualInformation}

CAPABILITIES:
1. Primary capability
2. Secondary capability
...

RULES:
- Important behavioral rules
- Tool selection guidelines
- Response formatting requirements

EXAMPLES:
- Example interactions and expected behaviors
`);
```

### 10. Error Handling and Fallback Pattern
```typescript
try {
  // Primary operation (e.g., Graphiti search)
  const primaryResult = await primaryService.operation();
  return primaryResult;
} catch (error) {
  console.warn('Primary service failed, trying fallback:', error);
  
  try {
    // Fallback operation (e.g., direct database search)
    const fallbackResult = await fallbackService.operation();
    return fallbackResult;
  } catch (fallbackError) {
    console.error('Both primary and fallback failed:', fallbackError);
    return defaultResult;
  }
}
```

## Best Practices

### Code Organization
- One agent per file with clear naming (ConversationAgent.ts)
- Separate tools into logical groups
- Keep utility functions together at file top
- Use TypeScript interfaces for all data structures

### Memory Management
- Always load memory context at conversation start
- Persist meaningful interactions to long-term memory
- Use appropriate context types for different scenarios
- Implement graceful degradation when memory services fail

### Tool Design
- Tools should be atomic and focused on single operations
- Include comprehensive input validation
- Provide clear success/failure feedback with emojis
- Support both ID-based and semantic search operations

### State Management
- Use LangGraph Annotation for reducer-based state updates
- Keep state minimal but sufficient for context
- Clear pending actions after execution
- Maintain conversation history appropriately

### Performance Optimization
- Cache expensive operations (like user node UUIDs)
- Use batch operations where possible
- Implement proper error boundaries
- Monitor and log performance metrics

## Agent Types and Specializations

### ConversationAgent (Implemented)
- **Purpose**: General conversation and calendar management
- **Tools**: Calendar CRUD, free time finding, daily briefing, memory search
- **Memory**: Full Graphiti integration with contextual search

### Future Agent Patterns

#### TaskOptimizationAgent
- **Purpose**: Intelligent task scheduling and prioritization
- **Tools**: Task CRUD, schedule optimization, workload analysis
- **Memory**: Focus on productivity patterns and completion history

#### GoalCoachingAgent  
- **Purpose**: Personal development and goal achievement
- **Tools**: Goal setting, progress tracking, habit formation
- **Memory**: Long-term goal context with motivational insights

#### PatternMiningAgent
- **Purpose**: User behavior analysis and insights
- **Tools**: Trend analysis, pattern detection, insight generation
- **Memory**: Historical analysis across all user interactions

## Testing Patterns

### Unit Testing
- Mock external services (Supabase, Graphiti, OpenAI)
- Test tool logic independently
- Validate state transitions
- Test error handling paths

### Integration Testing  
- Test agent workflows end-to-end
- Validate memory persistence and retrieval
- Test service fallback mechanisms
- Verify tool execution and results

### Memory Testing
- Test episode creation and storage
- Validate semantic search functionality
- Test context type filtering
- Verify fallback memory behavior