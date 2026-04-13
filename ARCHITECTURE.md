# Glyde - Architecture Overview

## System Architecture

```
User (Browser) --> Frontend (React/Vite :3000) --> Agent API (Express :8000) --> Supabase (PostgreSQL)
                                                        |                            |
                                                        +--> OpenAI GPT-5.4-mini    +--> RLS Policies
                                                        +--> Zep Cloud (Memory)
                                                        +--> Tavily (Web Search)
                                                        +--> Google Calendar API
                                                        +--> Microsoft Calendar API
```

## Database Schema

All tables in `public` schema with Row-Level Security (RLS) policies enforcing `user_id = auth.uid()`.

### Core Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `profile` | User metadata | display_name, timezone, preferences (JSONB), context_data (JSONB) |
| `aspects` | Color-coded life categories | name, color, icon, description, context (JSONB), display_order |
| `events` | Calendar events | title, start_time, end_time, aspect_id (FK), recurrence_rule, is_public |
| `tasks` | To-do items | title, status, priority, due_date, aspect_id (FK) |
| `goals` | Goal tracking | title, description, status, progress, target_date, aspect_id (FK) |
| `notes` | User notes (multi per user) | title, content, aspect_id (FK), created_at |
| `rules` | Agent behavior constraints | rule_text, enabled, conditions |

### Interaction System

| Table | Purpose |
|---|---|
| `user_interactions` | Agent-generated questions (yes_no, multiple_choice) |
| `interaction_responses` | User responses to interactions |

### Social

| Table | Purpose |
|---|---|
| `user_friendships` | Friend connections (status: pending/accepted/declined) |
| `friend_aspects` | Aspects shared with specific friends |
| `shared_aspect_members` | Members of shared aspects |
| `user_friend_visibility_settings` | Per-friend visibility controls |

### Infrastructure

| Table | Purpose |
|---|---|
| `user_activity_log` | Audit trail (entity_type, operation, changes JSONB, source: user/agent) |
| `user_connections` | OAuth credentials for Google/Microsoft |
| `user_calendar_mappings` | Maps external calendars to aspects |
| `chat_messages` | Conversation history |
| `recurring_event_exceptions` | Overrides for recurring event instances |
| `user_preferences` | Key-value user preferences |

### Aspect Linking

Events, tasks, and goals link to aspects via `aspect_id` (UUID FK to `aspects.id`).

## Agent Architecture

### Agent Types

| Agent | Class | Model | Purpose |
|---|---|---|---|
| Conversation | `ConversationAgent` | GPT-5.4-mini | Main chat interface, 82+ tools via LangGraph |
| Maintenance (Margaret) | `MaintenanceAgentMargaret` | GPT-5.4-mini | Data hygiene audits, aspect maintenance |
| Planner | `PlannerAgent` | GPT-5.4-mini | Goal decomposition and scheduling plans |
| Scheduler | `SchedulerAgent` | GPT-5.4-mini | Automated task scheduling and calendar optimization |
| Scribe | `ScribeAgent` | GPT-5.4-mini | Note research, daily digests, pattern scanning |
| Onboarding Enrichment | `OnboardingEnrichmentAgent` | GPT-5.4-mini | Enriches onboarding context for new users |

### Tool System

`ToolRegistry` singleton manages 82+ tools across 16+ categories:

| Category | Count | Examples |
|---|---|---|
| calendar | 12 | create_event, update_event, delete_event, recurring, analyze, find-free-time, bulk |
| friends | 9 | send-request, accept, decline, list, remove, add/remove-aspect, notes |
| projects | 7 | create, update, delete, list, archive, unarchive, tag-to-project |
| tasks | 6 | create_task, update_task, complete_task, list_tasks, search |
| aspects | 5 | create_aspect, update_aspect, list_aspects, archive, delete |
| goals | 5 | create_goal, update_goal, delete, check_in_goal, list |
| shared-events | 4 | add-member, remove-member, get-members, update-role |
| reminders | 4 | create, update, delete, list |
| rules | 4 | create_rule, toggle_rule, delete_rule, list_rules |
| memory | 3 | search-unified, update-advanced, manage-patterns |
| notes | 3 | create, get, update |
| interactions | 1 | create_interaction |
| profile | 2 | get_profile, update_profile |
| search | 2 | web_search, location_search |
| suggestions | 6 | create_action_suggestion, list_action_suggestions, create_placement_slot, swap_slot_random, confirm_slot, dismiss_slot |

### Memory System

- **Zep Cloud**: Primary memory layer -- graph-based persistent memory with user/session management.
- **ZepMemoryService**: Handles memory search, context retrieval, and user session management via Zep Cloud API.
- **ZepGraphService**: Knowledge graph operations for entity and relationship tracking.
- **MemoryService**: Unified memory service handling fact extraction, context generation, and pattern management.
- **memory_facts table**: Stores user knowledge with embeddings (1536-dim, text-embedding-3-small) via pgvector.
- **user_context_cache table**: Pre-built user context summaries, rebuilt periodically.
- Fallback: Supabase `chat_messages` table for conversation history.

### Agent Prompt System

Each agent has:
- `prompts.ts` with a typed `PromptContext` interface
- `buildXxxSystemPrompt(context)` returning `SystemMessage`
- Context includes: timezone, eventContext, taskContext, goalContext, aspectContext, profileContext, rulesContext
- ConversationAgent prompt is ~840 lines with detailed tool selection guides

## API Layer

Express server (`api/server.ts`) with:
- 31+ POST endpoint modules organized by domain
- Auth middleware (`authenticateRequest`) validating Supabase JWTs
- Input sanitization middleware
- CORS configured for web and mobile clients
- Rate limiting (currently disabled via `RATE_LIMIT_DISABLED`)

### Key Endpoints

```
POST /api/chat              # Main conversation endpoint
POST /api/aspects/*         # Aspect CRUD
POST /api/events/*          # Event CRUD
POST /api/tasks/*           # Task CRUD
POST /api/goals/*           # Goal CRUD
POST /api/rules/*           # Rule management
POST /api/interactions/*    # Interaction management
POST /api/friends/*         # Social features
POST /api/notes/*           # Notes management
POST /api/projects/*        # Project management
POST /api/reminders/*       # Reminder management
POST /api/push/*            # Push notifications
POST /api/inbox/*           # Unified inbox
POST /api/suggestions/*     # Action suggestions and placement slots
POST /api/knowledge-graph/* # Entity linking
POST /api/note-links/*      # Wiki-style note linking
POST /api/note-templates/*  # Note templates
POST /api/analytics/*       # Analytics
POST /api/connections/*     # OAuth connections
POST /api/calendar-mappings/* # Calendar sync
```

## Frontend Architecture

React 18 + Vite + TypeScript + TailwindCSS.

### Context Providers

```
AuthProvider > ThemeProvider > RuleProvider > ConnectionProvider > AspectProvider > ProjectProvider
```

### Key Components

- `Calendar.tsx` - Main calendar view with day/week/month modes
- `ChatBot.tsx` - Conversation interface with streaming responses
- `FriendsSection.tsx` - Friend management, aspect tagging, notes
- `NotesPage.tsx` - Notes editor with aspect-based organization
- `AspectBreakdownCard.tsx` - Aspect distribution visualization

### Data Flow

Frontend calls Agent API (not Supabase directly for writes). Reads use Supabase client with anon key + RLS. Real-time updates via Supabase subscriptions.

## Infrastructure

### Docker Compose

- `glydeeee-agents`: Node.js backend, port 8000
- `glydeeee-frontend`: Vite dev server, port 3000->5173, volume mounts for hot-reload

### Development Workflow

- Frontend: Edit files, changes hot-reload via Docker volume mounts
- Agent: Edit files, rebuild with `docker compose build --no-cache agent`

## Key Design Decisions

1. **Public schema + RLS** over per-user schemas (simpler, scales better)
2. **Aspects as first-class entities** over flat tags (supports context, ordering, archiving)
3. **LangGraph over simple chains** (supports complex multi-tool workflows with recursion)
4. **pgvector over external memory services** (local vector memory with LLM fact extraction)
5. **Docker Compose** for consistent dev environment across team
6. **Agent API as gateway** - frontend doesn't call LLMs directly
