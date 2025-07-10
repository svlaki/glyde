# Claude Code Assistant Instructions

## Project Overview
We are building a Personal Intelligence Operating System that merges a smart calendar, task list, and AI life-coach. The system continuously learns user patterns, values, and goals to provide both tactical clarity ("What do I do next?") and strategic direction ("Why am I doing it?").

## Current Architecture
- **Frontend**: React with TypeScript
- **Calendar**: FullCalendar library for week-view
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Embeddings**: OpenAI Ada model for events and chat messages
- **Vector Storage**: Supabase pgvector extension

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
- **Streaming Interface**: Real-time updates via Vercel AI SDK
- **Type Safety**: Full TypeScript interfaces for all agent interactions

### Technical Stack for Agents
- **LangChain.js**: Core agent functionality and tool calling
- **Vercel AI SDK**: Streaming responses to React frontend
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
4. Results stream back to frontend via **Vercel AI SDK**
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

Integration Points

Supabase Realtime: Subscribe to table changes
OpenAI Streaming: Use Vercel AI SDK
Vector Search: Use pgvector for similarity
Calendar Sync: Google Calendar API (future)

Development Workflow

Agent Development Process:
1. Define agent purpose and capabilities
2. Create centralized tools in `/tools/` directory
3. Implement agent using BaseAgent class
4. Register agent in AgentRegistry
5. Add streaming support via Vercel AI SDK
6. Test tool integration and memory persistence
7. Update TypeScript interfaces

Tool Development Process:
1. Create tool in appropriate `/tools/` subdirectory
2. Implement with standardized input/output schemas
3. Add to tool registry for agent access
4. Include comprehensive error handling
5. Add vector embedding support if needed
6. Test with multiple agents

Standard Development:
- Feature branches from main
- Descriptive commit messages
- PR descriptions with context
- Test before committing
- Update types when changing data structures
- Always run agent tests after tool changes

Future Considerations

Mobile app (React Native)
Offline support (PWA)
Voice interface
Multi-language support
Enterprise features

Response Guidelines
When providing code:

Include all necessary imports
Add TypeScript types
Handle loading/error states
Include brief comments for complex logic
Suggest related improvements

When explaining decisions:

Reference project goals
Consider performance impact
Maintain consistency
Think about user experience
Plan for scalability

Current Priorities

Implement base agent infrastructure
Create streaming chat interface
Build natural language → calendar action pipeline
Add goal tracking system
Implement pattern detection

Remember: We're building an intelligent system that should feel like a trusted personal assistant. Every feature should make users' lives more intentional and productive.