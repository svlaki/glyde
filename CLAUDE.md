# Claude Code Assistant Instructions

## Project Overview
We are building a Personal Intelligence Operating System that merges a smart calendar, task list, and AI life-coach. The system continuously learns user patterns, values, and goals to provide both tactical clarity ("What do I do next?") and strategic direction ("Why am I doing it?").

## Current Architecture
- **Frontend**: React with TypeScript
- **Calendar**: FullCalendar library for week-view
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Embeddings**: OpenAI Ada model for events and chat messages
- **Vector Storage**: Supabase pgvector extension
- **Code Intelligence**: Serena MCP for semantic code analysis
- **Documentation**: Context7 MCP for up-to-date library docs

## Codebase Structure
├── src/
│   ├── components/
│   │   ├── Calendar/
│   │   ├── Chat/
│   │   └── Dashboard/
│   ├── lib/
│   │   ├── supabase/
│   │   └── openai/
│   ├── hooks/
│   └── types/
├── supabase/
│   ├── migrations/
│   └── functions/
└── package.json

## Development Philosophy
1. **Type Safety First**: Use TypeScript interfaces for all data structures
2. **Real-time by Default**: Leverage Supabase Realtime for instant updates
3. **Privacy-Conscious**: User data should be encrypted where possible
4. **Performance Matters**: Optimize for sub-100ms response times
5. **User Experience**: Every interaction should feel intelligent and proactive

## Agent Framework Architecture (Implementation Status: In Progress)
We're implementing a unified LangChain/LangGraph system with centralized tool architecture:

### Core Agents
1. **Conversation Agent** (LangGraph): ✅ IMPLEMENTED - Natural language understanding for calendar/task commands
2. **Task Scheduling Agent** (LangGraph): 🔄 PLANNED - Optimize calendar and task allocation
3. **Pattern Mining Agent** (LangGraph): 🔄 PLANNED - Analyze user behavior from embedded data
4. **Life Coaching Agent** (LangGraph): 🔄 PLANNED - Structured goal-setting and progress tracking
5. **Proactive Suggestion Agent** (LangGraph): 🔄 PLANNED - Context-aware recommendations

### Agent Architecture Principles
- **Centralized Tool System**: All tools are centralized in `/tools/` directory
- **Tool-Based Communication**: Agents use standardized tool calls for actions
- **Shared Memory**: Vector embeddings and persistent memory shared across agents
- **Streaming Interface**: Real-time LLM responses via @llm-ui/react
- **Type Safety**: Full TypeScript interfaces for all agent interactions

### Technical Stack for Agents
- **LangChain.js**: Core agent functionality and tool calling
- **@llm-ui/react**: Streaming LLM responses to React frontend
- **OpenAI GPT-4**: Primary LLM (with option for local models)
- **Supabase**: Persistent memory, vector search, and real-time updates

### Tool Architecture
```
src/tools/
├── calendar/           # Calendar management tools
│   ├── create-event.ts
│   ├── update-event.ts
│   ├── delete-event.ts
│   └── search-events.ts
├── tasks/              # Task management tools
│   ├── create-task.ts
│   ├── update-task.ts
│   └── prioritize-tasks.ts
├── analysis/           # Pattern analysis tools
│   ├── analyze-patterns.ts
│   └── generate-insights.ts
├── coaching/           # Goal and coaching tools
│   ├── set-goal.ts
│   ├── track-progress.ts
│   └── suggest-actions.ts
└── chat/               # Communication tools
    ├── search-similar.ts
    └── update-memory.ts
```

### Agent Communication Flow
1. User sends message → **Conversation Agent** (orchestrator)
2. Conversation Agent determines which specialized agents to involve
3. Agents execute via **centralized tool calls**
4. Results stream back to frontend via **@llm-ui/react**
5. All actions persisted to **Supabase** with vector embeddings

## Key Features to Implement
1. **Natural Language Calendar Management**
   - "Schedule a meeting with John next Tuesday at 2pm"
   - "Move my morning meetings to the afternoon"
   - "Find time for deep work this week"

2. **Intelligent Task Prioritization**
   - Eisenhower Matrix automation
   - Energy-based scheduling
   - Deadline awareness

3. **Goal Tracking & Coaching**
   - SMART goal decomposition
   - Progress visualization
   - Habit streak tracking

4. **Pattern Recognition**
   - Peak productivity hours detection
   - Meeting overload warnings
   - Work-life balance insights

5. **Proactive Assistance**
   - Travel time notifications
   - Meeting preparation reminders
   - Goal check-ins

## Database Schema Patterns
```sql
-- Core tables already exist:
-- users, events, tasks, chat_messages

-- To be added for agents:
-- user_profiles (values, goals, preferences)
-- agent_memories (conversation history, insights)
-- patterns (detected behaviors, suggestions)
-- goals (SMART goals, milestones, progress)
Code Style Guidelines

Components: Functional components with hooks
State Management: React Context for global state, local state for components
API Calls: Always use try-catch with proper error handling
Types: Define interfaces for all props and data structures
Comments: Focus on WHY, not WHAT

Performance Considerations

Use React.memo for expensive components
Implement virtual scrolling for long lists
Debounce search and filter operations
Cache embedding results
Stream LLM responses

Security Requirements

Never expose API keys in frontend code
Use Supabase RLS policies
Validate all user inputs
Sanitize LLM outputs before rendering
Implement rate limiting

Testing Approach

Unit tests for utility functions
Integration tests for Supabase operations
Component tests with React Testing Library
E2E tests for critical user flows
Mock LLM responses in tests

Common Commands Examples
When asked to implement a feature:

First check existing code patterns
Create TypeScript interfaces
Implement with error handling
Add loading and error states
Include basic tests

When asked to review code:

Check TypeScript types
Verify error handling
Look for performance issues
Ensure consistent patterns
Suggest improvements

When asked about architecture:

Consider scalability
Maintain consistency with existing patterns
Prioritize user experience
Keep it simple and maintainable

## MCP Server Integration & Advanced Development Tools

### MANDATORY: Claude Code Session Protocol
**EVERY Claude Code session MUST:**
1. **Acknowledge CLAUDE.md** - Start sessions by confirming awareness of project context and these guidelines
2. **Update Memory** - Document architectural decisions, implementation patterns, and context changes using `mcp__serena__write_memory`
3. **Check Memory** - Use `mcp__serena__list_memories` and `mcp__serena__read_memory` to understand project evolution
4. **Use Semantic Tools** - Prioritize serena's symbolic analysis over reading entire files

### Serena MCP: Semantic Code Intelligence
**PRIMARY CODE EXPLORATION TOOL** - Use instead of reading entire files

#### Core Workflow - ALWAYS Follow This Pattern:
1. **Start with Overview**: `mcp__serena__get_symbols_overview` for new files
2. **Navigate Semantically**: `mcp__serena__find_symbol` with specific name paths
3. **Understand Relationships**: `mcp__serena__find_referencing_symbols` for impact analysis
4. **Edit Precisely**: `mcp__serena__replace_symbol_body` or `mcp__serena__insert_after_symbol`

#### Essential Serena Tools:
```typescript
// File exploration
mcp__serena__list_dir          // Directory structure
mcp__serena__find_file         // Locate files by pattern
mcp__serena__get_symbols_overview  // File symbol summary

// Semantic navigation
mcp__serena__find_symbol       // Find classes, functions, methods
mcp__serena__search_for_pattern    // Advanced pattern matching
mcp__serena__find_referencing_symbols  // Usage analysis

// Precise editing
mcp__serena__replace_symbol_body    // Replace entire symbol
mcp__serena__insert_after_symbol    // Add new code after symbol
mcp__serena__insert_before_symbol   // Add imports, prepend code

// Project memory
mcp__serena__write_memory      // Document architectural decisions
mcp__serena__read_memory       // Access project context
mcp__serena__list_memories     // Browse available memories
```

#### Serena Best Practices:
- **Never read entire files** unless absolutely necessary - use symbolic tools first
- **Name paths**: Use `/ClassName/methodName` for absolute paths, `ClassName/methodName` for relative
- **Include body**: Only set `include_body=true` when you need implementation details
- **Memory management**: Write key architectural decisions to memory for future reference
- **Context efficiency**: Use `relative_path` parameter to limit search scope

#### Example Serena Workflow:
```typescript
// 1. Explore project structure
mcp__serena__list_dir({ relative_path: ".", recursive: false })

// 2. Get file overview
mcp__serena__get_symbols_overview({ relative_path: "src/agents/ConversationAgent.ts" })

// 3. Find specific class with methods
mcp__serena__find_symbol({ 
  name_path: "ConversationAgent", 
  relative_path: "src/agents/ConversationAgent.ts",
  depth: 1,
  include_body: false 
})

// 4. Read specific method
mcp__serena__find_symbol({ 
  name_path: "ConversationAgent/processMessage", 
  relative_path: "src/agents/ConversationAgent.ts",
  include_body: true 
})

// 5. Find all references before editing
mcp__serena__find_referencing_symbols({
  name_path: "ConversationAgent/processMessage",
  relative_path: "src/agents/ConversationAgent.ts"
})
```

### Context7 MCP: Live Documentation Intelligence
**ALWAYS USE FOR LIBRARY QUESTIONS** - Never guess API documentation

#### Context7 Workflow:
```typescript
// 1. Resolve library name to Context7 ID
mcp__context7__resolve-library-id({ libraryName: "langchain" })

// 2. Get targeted documentation
mcp__context7__get-library-docs({ 
  context7CompatibleLibraryID: "/langchain/langchainjs",
  topic: "agents", 
  tokens: 8000 
})
```

#### Context7 Best Practices:
- **Always resolve first** - Use `resolve-library-id` before `get-library-docs`
- **Be specific** - Use `topic` parameter for targeted results
- **Token management** - Adjust `tokens` based on needed detail (default: 10000)
- **Update memory** - Document new library patterns and best practices

### Memory Management Protocol
**MANDATORY for all development sessions:**

#### When to Write Memory:
- **Architectural Decisions**: New patterns, framework choices, design principles
- **Implementation Patterns**: Reusable code patterns, common solutions
- **Integration Points**: How systems connect, API contracts, data flows
- **Debugging Solutions**: Complex bug fixes, performance optimizations
- **Library Usage**: New library integrations, best practices discovered

#### Memory Naming Convention:
```typescript
// Architecture
"architecture-agent-communication-flow"
"architecture-database-schema-patterns"

// Implementation
"implementation-react-component-patterns"
"implementation-supabase-realtime-setup"

// Integration
"integration-langchain-vercel-ai-sdk"
"integration-openai-embedding-workflow"

// Solutions
"solution-streaming-response-debugging"
"solution-typescript-agent-interfaces"
```

#### Example Memory Usage:
```typescript
// Document new architectural decision
mcp__serena__write_memory({
  memory_name: "architecture-agent-tool-registry",
  content: `# Agent Tool Registry Pattern

## Implementation
- Centralized tool definitions in /tools/ directory
- Each tool exports standardized schema with input/output types
- Tools registered in AgentRegistry for cross-agent access
- Streaming support via @llm-ui/react integration

## Key Files
- src/tools/registry.ts - Central tool registration
- src/agents/BaseAgent.ts - Tool calling interface
- src/types/agents.ts - Tool schema definitions

## Usage Pattern
Tools are called via standardized interface that maintains type safety
and enables real-time streaming to React frontend.`
})

// Check existing memories before starting work
mcp__serena__list_memories()
mcp__serena__read_memory({ memory_file_name: "architecture-agent-communication-flow" })
```

Integration Points

Supabase Realtime: Subscribe to table changes
OpenAI Streaming: Use @llm-ui/react for real-time LLM responses
Vector Search: Use pgvector for similarity
Calendar Sync: Google Calendar API (future)
Serena MCP: Semantic code analysis and precise editing
Context7 MCP: Up-to-date library documentation

Development Workflow

### Enhanced Development Process with MCP Integration

#### Session Initialization (MANDATORY):
1. **Acknowledge CLAUDE.md** - Confirm understanding of project context and MCP capabilities
2. **Check existing memories** - `mcp__serena__list_memories()` to understand project evolution
3. **Read relevant memories** - Use `mcp__serena__read_memory()` for context-specific information
4. **Set project path** - `mcp__code-index__set_project_path()` for enhanced search capabilities

#### Code Exploration Process:
1. **Start semantic** - Use `mcp__serena__get_symbols_overview()` instead of reading entire files
2. **Navigate precisely** - Use `mcp__serena__find_symbol()` with specific name paths
3. **Understand impact** - Use `mcp__serena__find_referencing_symbols()` before making changes
4. **Search intelligently** - Use `mcp__code-index__search_code_advanced()` for pattern matching

#### Implementation Process:
1. **Research libraries** - Use `mcp__context7__resolve-library-id()` and `mcp__context7__get-library-docs()`
2. **Edit semantically** - Use `mcp__serena__replace_symbol_body()` or `mcp__serena__insert_after_symbol()`
3. **Document decisions** - Use `mcp__serena__write_memory()` for architectural choices
4. **Validate changes** - Run tests and type checks

#### Agent Development Process:
1. **Define agent purpose** and capabilities using semantic analysis
2. **Research existing patterns** via memory and symbolic exploration  
3. **Create centralized tools** in `/tools/` directory with proper schemas
4. **Implement agent** using BaseAgent class and documented patterns
5. **Register agent** in AgentRegistry with full type safety
6. **Add streaming support** via @llm-ui/react integration
7. **Test tool integration** and memory persistence
8. **Update TypeScript interfaces** and document in memory
9. **Write memory** documenting the new agent's capabilities and integration

#### Tool Development Process:
1. **Research existing tools** using `mcp__serena__search_for_pattern()`
2. **Create tool** in appropriate `/tools/` subdirectory following existing patterns
3. **Implement schemas** with standardized input/output types
4. **Add to tool registry** for cross-agent access
5. **Include comprehensive error handling** and validation
6. **Add vector embedding support** if needed for semantic search
7. **Test with multiple agents** and document usage patterns
8. **Update memory** with new tool capabilities and best practices

#### Standard Development with MCP:
- **Always use semantic tools** - Avoid reading entire files
- **Memory-driven development** - Document and reference architectural decisions
- **Library-first approach** - Use Context7 for up-to-date documentation
- **Feature branches from main** with comprehensive testing
- **Descriptive commit messages** referencing memory entries
- **PR descriptions with context** from documented architectural decisions
- **Test before committing** using established patterns
- **Update types** when changing data structures, document in memory
- **Run agent tests** after tool changes and update documentation

Future Considerations

Mobile app (React Native)
Offline support (PWA)
Voice interface
Multi-language support
Enterprise features

Response Guidelines

### Enhanced Response Guidelines with MCP Integration

#### When providing code:
- **Use semantic analysis first** - Always explore with `mcp__serena__get_symbols_overview()` before writing code
- **Reference existing patterns** - Use `mcp__serena__find_symbol()` to understand current implementations  
- **Include all necessary imports** with proper TypeScript types
- **Handle loading/error states** following established patterns
- **Document architectural decisions** in memory for future reference
- **Validate with up-to-date docs** using Context7 for library integrations

#### When explaining decisions:
- **Reference project memories** - Cite documented architectural decisions and patterns
- **Consider performance impact** with semantic understanding of existing code
- **Maintain consistency** by analyzing similar implementations via symbolic tools
- **Think about user experience** within the context of documented project goals
- **Plan for scalability** using established architectural patterns from memory
- **Update project knowledge** by writing key insights to memory

#### Session Management Protocol:
Every development session should:
1. **Start with acknowledgment** of CLAUDE.md and current project state
2. **Check relevant memories** before beginning implementation
3. **Use semantic exploration** instead of reading entire files
4. **Document new patterns** and architectural decisions
5. **Update memories** with implementation insights and best practices

Current Priorities

Implement base agent infrastructure
Create streaming chat interface
Build natural language → calendar action pipeline
Add goal tracking system
Implement pattern detection

Remember: We're building an intelligent system that should feel like a trusted personal assistant. Every feature should make users' lives more intentional and productive.