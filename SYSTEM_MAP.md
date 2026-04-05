# Glyde System Map

## 1) What Glyde Is

Glyde is an AI-native life management system. It combines calendar planning, tasks, goals, reminders, projects, notes, social coordination, and memory into one operational graph organized by **Aspects** (color-coded life domains like Health, Work, Family, etc.).

The product model is:
- Users manage life objects (events, tasks, goals, projects, notes, plans).
- Every object can be linked to an Aspect.
- Agent workflows (chat + proactive interactions) help users create, update, analyze, and coordinate these objects.
- External systems (Google/Microsoft calendars, push notifications, web search, memory graph) are integrated as first-class services.

## 2) Current System Topology

```text
User Clients
  - Web app (React/Vite)
  - iOS app (Capacitor wrapper)
  - Electron desktop build

        |
        v
Frontend (apps/frontend)
  - Auth/session via Supabase client
  - UI pages + contexts + feature services
  - Calls Agent API for domain operations and AI actions

        |
        v
Agent API (apps/agents, Express on :8000)
  - Domain endpoints (events/tasks/goals/etc.)
  - Agent endpoints (process/stream)
  - Auth middleware + sanitization + validation
  - Jobs (reminders, notifications, watch renewal)

        |
        +--------------------------+
        v                          v
Supabase Postgres + RLS         OpenAI (GPT-5.1 via LangChain/LangGraph)
  - Primary data store           - Conversation + specialized agents
  - User-scoped security         - Tool-calling orchestration

        |
        +--------------------------+-----------------------------+
        v                          v                             v
Zep Cloud memory graph         Google/Microsoft APIs         Tavily web search
Push notification channels     Calendar sync/mapping         External knowledge
```

## 3) Monorepo Layout (Current)

```text
glydeproper/
  apps/
    agents/        Node/TypeScript backend (Express + LangGraph tools)
    frontend/      React/Vite TypeScript app (web + mobile/desktop targets)
  supabase/
    migrations/    SQL schema and evolution history
    config.toml    Supabase local/project config
  mcp-server-zep-cloud/  Python MCP server utilities for Zep Cloud
  tests/           JS integration and behavior test scripts
  docker-compose.yml
  README.md
  ARCHITECTURE.md
```

## 4) Runtime Components

### Frontend (`apps/frontend`)

Responsibilities:
- Authentication UX and session context.
- Primary feature pages (Calendar, Profile, Aspects, Projects, Friends, Notes, Ratings, Reminders, Connections).
- Chat interface and interaction handling.
- Onboarding flow and completion gating.
- Analytics capture and push notification initialization.

Routing highlights (from `main.tsx`):
- `/calendar`, `/profile`, `/aspects`, `/projects`, `/friends`, `/connections`, `/notes`, `/ratings`, `/reminders`, `/onboarding`, `/oauth/callback`, `/admin/analytics`.

State contexts in app shell:
- `AuthProvider`, `ThemeProvider`, `RuleProvider`, `ConnectionProvider`, `AspectProvider`, `ProjectProvider`, plus keyboard and analytics wiring.

### Agent API (`apps/agents`)

Responsibilities:
- Domain CRUD and orchestration APIs.
- Agent execution endpoints for conversational and streaming responses.
- Middleware stack: CORS, auth, input sanitization/validation, request limiting, performance tracking.
- Integrations: Supabase, OpenAI, Zep, Tavily, Google, Microsoft, push notifications.
- Background jobs and maintenance scripts.

Key exposed endpoint groups:
- `/api/events/*`
- `/api/tasks/*`
- `/api/goals/*`
- `/api/aspects/*`
- `/api/projects/*`
- `/api/reminders/*`
- `/api/friends/*`
- `/api/shared-aspects/*`
- `/api/shared-events/*`
- `/api/connections/*`
- `/api/chat/*`
- `/api/agent/process`, `/api/agent/stream`
- `/api/calendar/*` (Google auth/import/upload/analysis)
- `/api/interactions/*`, `/api/rules/*`, `/api/ratings/*`, `/api/onboarding/*`, `/api/analytics/*`

### Data Layer (Supabase/Postgres)

Core domain tables (from docs + migrations):
- `profile`, `aspects`, `events`, `tasks`, `goals`, `notes`, `projects`, `rules`, `reminders`
- `user_interactions`, `interaction_responses`, `chat_messages`, `user_activity_log`
- `user_friendships`, shared aspect/event membership and visibility tables
- `user_connections`, `user_calendar_mappings`, recurring-event exception support

Design rule:
- Aspects are the organizing primitive. Objects reference `aspect_id` for consistent life-domain grouping.

### Agent Layer

Active agent classes in backend:
- `ConversationAgent`: primary user chat assistant with tool calling.
- `InteractionAgentGerald`: proactive prompts/interactions and follow-up behavior.
- `MaintenanceAgentMargaret`: data quality and system hygiene focus.
- `OnboardingEnrichmentAgent`: enriches onboarding context.

Tools are organized by capability folders:
- calendar, tasks, goals, aspects, projects, reminders, profile, plans, rules, interactions, friends, shared-events, memory, search, notes.

## 5) End-to-End Data Flow

### A. Standard CRUD flow
1. User acts in frontend page.
2. Frontend service calls Agent API endpoint.
3. API validates auth/user context.
4. Domain service writes/reads Supabase.
5. Response returns to UI and updates local state.

### B. Chat/agent flow
1. User sends natural language message.
2. Frontend calls `/api/agent/process` or `/api/agent/stream`.
3. Conversation agent builds context (profile/aspects/history/rules/memory).
4. Agent chooses and executes tools (calendar/task/goal/etc.).
5. Side effects persist to Supabase; memory may sync to Zep.
6. Structured + conversational response returns to user.

### C. Calendar integration flow
1. User connects provider (Google or Microsoft).
2. OAuth token data stored in `user_connections`.
3. Calendar list synced and mapped to Aspects.
4. Sync/import jobs move external events into internal model.

### D. Proactive interaction flow
1. Scheduled/background logic identifies trigger conditions.
2. Gerald creates interaction records.
3. Frontend surfaces pending interactions.
4. User responses are stored and can drive follow-up actions.

## 6) Deployment and Environments

Primary local/dev runtime uses Docker Compose:
- `agent` container on port `8000`.
- `frontend` container exposed on host `3000` (internal Vite `5173`).

Env-driven integrations:
- Supabase URL/service key/anon key
- OpenAI key
- Zep key/base URL
- Tavily key
- Google + Microsoft OAuth credentials
- Optional admin user IDs and callback URLs

## 7) Product Capability Map (Current)

Implemented domains:
- Aspect-based life organization
- Calendar + recurring events + friend visibility
- Tasks, goals, projects, reminders, ratings, notes
- Conversational command-and-control via AI agent
- Proactive interaction agent
- Maintenance/hygiene agent
- Social graph and shared planning constructs
- External calendar connections and mapping
- Persistent memory integration (Zep)

Planned/expanding domains (per repo docs):
- Deeper location tracking
- Fitness and sleep integration

## 8) System Identity Summary

Glyde is not a single feature app; it is a **life operations platform** with an AI control layer.

Its defining architecture choices are:
- Aspect-centric data model for cross-domain consistency.
- Agent-first orchestration (tools over simple chat responses).
- Supabase as secure operational backbone.
- Memory graph + external connectors for continuity beyond one session.
- Multi-client delivery (web first, with mobile/desktop packaging).
