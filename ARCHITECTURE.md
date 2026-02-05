# Glyde Proper - Architecture Overview

## Critical Schema Structure

**IMPORTANT: The system uses PUBLIC SCHEMAS with RLS policies, NOT per-user schemas.**

Historical context: Migration `20260122000001_drop_unused_user_schema_functions.sql` consolidated from per-user schemas (`u_<uuid>`) to the public schema. Old per-user schema data is preserved but no longer used for new data.

### Database Schema

All user data is in `public` schema with Row-Level Security (RLS) policies:

**User Management:**
- `auth.users` - Supabase authentication
- `profile` - User metadata (display_name, avatar_url, timezone, preferences, context_data JSONB)
- `user_connections` - OAuth credentials for Google/Microsoft calendars
- `user_calendar_mappings` - Maps external calendars to Glyde aspects/categories

**Calendar & Events:**
- `public.events` - Calendar events (user_id, title, start_at, end_at, category_id, recurrence JSONB, archetype, color)
- `public.tasks` - Todos with metadata (user_id, title, duration, energy_required, goal_id)
- `public.goals` - Goal tracking (user_id, title, description, category_id, key_results JSONB)
- `public.goal_check_ins` - Daily/weekly progress (user_id, goal_id, mood, confidence)

**Organization & Sharing:**
- `public.categories` - System categories (Work, Health, Personal, Learning, Finance + subcategories)
- `user_categories` - User's category settings (active, custom colors/names)

**Conversation & Memory:**
- `public.chat_messages` - Conversation history (user_id, session_id, content, sender, embedding)

**Audit:**
- `public.user_activity_log` - All entity changes (user_id, entity_type, operation, changes JSONB, source: user|agent, agent_type)

**Planning & Rules:**
- `public.user_life_plans` - Multi-month planning (user_id, phases, reflections)
- `public.user_rules` - Personal/org rules (user_id, rule_text, conditions)

### RLS Policy Pattern

All tables enforce this pattern:
```sql
-- Users see only their own data
CREATE POLICY "Users can access own data" ON table_name
  FOR ALL USING (auth.uid() = user_id);

-- Service role (backend) bypasses RLS for background jobs
CREATE POLICY "Service role full access" ON table_name
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

### Key Aspects System

**Aspects** are life domains: Work, Health, Personal, Learning, Finance.

Data flow:
- Defined in `public.categories` (system-wide definitions)
- Users select during onboarding → stored in `profile.context_data.life_aspects` (JSONB array)
- Events/tasks/goals link to aspects via `category_id` foreign key
- Frontend groups display by aspect

### Agent Architecture

**AgentRegistry Pattern:**
- Central singleton orchestrator managing all agents
- Routes messages to appropriate agent or defaults to conversation agent
- Delegates between agents as needed

**Agent Types:**
- Conversation - Main interface, orchestrator
- Interaction (Gerald) - User interaction, suggestions
- Maintenance (Margaret) - System maintenance, consistency
- Scheduling, Pattern Mining, Coaching, Proactive (extensible)

**Memory Management:**
- Zep Cloud integration for persistent memory contexts
- Fallback to Supabase if Zep unavailable
- Memory contexts: conversation, task_planning, goal_coaching
- Conversation history in `public.chat_messages` with 1536-dim embeddings

### External Integrations

**Calendar Sync:**
- Google Calendar OAuth via `user_connections`
- Microsoft Graph OAuth via `user_connections`
- Per-calendar sync tracking and watch subscriptions in `user_calendar_mappings`

**AI/LLM:**
- OpenAI GPT-5.1 via LangChain
- Embeddings for vector search (1536 dimensions)

**Memory Backend:**
- Zep Cloud for multi-context memory
- Redis + Bull for background job queues
- ChromaNode for local vector embeddings (fallback)

## File Organization

```
apps/agents/
├── src/
│   ├── agents/           # Agent implementations (BaseAgent, AgentRegistry)
│   ├── api/              # Express routes, middleware, auth
│   ├── services/         # Business logic (SupabaseService, ZepMemoryService, etc.)
│   ├── types/            # TypeScript interfaces and types
│   ├── scripts/          # Utility scripts
│   └── index.ts          # Server entry point

apps/frontend/
├── src/
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page routes
│   ├── services/         # API clients
│   └── types/            # TypeScript interfaces

supabase/
├── migrations/           # Database migrations (applied in order)
└── functions/            # PostgreSQL functions (if any)
```

## Key Design Patterns

### API Response Format
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number }
}
```

### Authentication Flow
1. Supabase Auth or custom JWT
2. Bearer token in Authorization header
3. `authenticateRequest()` middleware validates and sets `req.authUserId`
4. All operations use `req.authUserId` for RLS

### Aspect-Based Organization
Events/tasks/goals are grouped by aspect/category for user-centric organization.

### Activity Logging
Every mutation is logged to `user_activity_log` with:
- Entity type (event/task/goal/category/profile/rule)
- Operation (create/update/delete/complete)
- Changes (before/after values)
- Source (user or agent+agent_type)

Used for audit trails and agent decision-making context.

## Important Notes

1. **NO per-user schemas** - All data is in public schema with RLS
2. **RLS enforcement** - PostgreSQL RLS policies provide data isolation
3. **Activity logging** - Comprehensive audit trail for compliance and agent context
4. **Zep memory** - Used for contextual AI responses, persistent across sessions
5. **Vector embeddings** - 1536-dim vectors for semantic search in chat/events
