# Glyde

Glyde is an AI-native life management and coordination system. It centralizes a user's schedule, tasks, goals, and notes around color-coded **aspects** -- flexible categories that organize every object in the system. A conversational agent handles most actions through natural language, automatically creating events, assigning aspects, filling in details, and keeping everything connected.

## Features

| Feature | Status |
|---|---|
| Aspects (color-coded life categories) | Built |
| Calendar (events, recurring events, Google/Microsoft sync) | Built |
| Tasks (to-do list with priorities, due dates, aspects) | Built |
| Goals (milestones, progress tracking, check-ins) | Built |
| Notes (wiki-linked, aspect-tagged, multi-note) | Built |
| Projects (entity grouping, archiving, tagging) | Built |
| Reminders (time-based notification cards) | Built |
| Conversation Agent (82+ tools, natural language) | Built |
| Planner Agent (goal decomposition, scheduling) | Built |
| Scheduler Agent (automated task scheduling) | Built |
| Scribe Agent (note research, daily digests) | Built |
| Maintenance Agent Margaret (data hygiene audits) | Built |
| Onboarding Enrichment Agent (new user setup) | Built |
| Inbox (unified interactions, invites, friend requests) | Built |
| Suggestions (action suggestions with placement slots) | Built |
| Knowledge Graph (entity linking, visualization) | Built |
| Rules (user-defined agent behavior constraints) | Built |
| Social (friends, aspect tagging, shared events) | Built |
| Persistent memory (pgvector embeddings + fact extraction) | Built |
| Web search enrichment (Tavily) | Built |
| Push notifications (VAPID web push) | Built |

## Tech Stack

- **Frontend**: React 18, Vite 7, TypeScript, TailwindCSS 4, Framer Motion
- **Backend**: Node.js, Express, LangGraph, OpenAI GPT-5.4-mini
- **Database**: Supabase (PostgreSQL with RLS)
- **Memory**: Supabase pgvector embeddings + LLM-based fact extraction
- **Search**: Tavily API
- **Calendar**: Google Calendar API + Microsoft Calendar API (OAuth2)
- **Infrastructure**: Docker Compose

## Architecture

```
glydeproper/
  apps/
    agents/             # Node.js backend (port 8000)
      src/
        agents/         # ConversationAgent, Margaret, Planner, Scheduler, Scribe
        api/            # Express routes (31+ endpoint modules)
        services/       # 20 domain services
        tools/          # 82+ LangGraph tools across 16+ categories
        config/         # Agent configuration
        jobs/           # Background jobs (memory, reminders, notifications)
    frontend/           # React/Vite frontend (port 5173, exposed on 3000)
      src/
        pages/          # CalendarPage, NotesPage, GoalsPage, ProfilePage, etc. (12 pages)
        components/     # 45+ components (Calendar, ChatBot, Profile, Friends, etc.)
        lib/            # Services, contexts, utilities
        hooks/          # Custom React hooks
  archive/              # Archived features (Gerald, Ratings, Plans)
  docker-compose.yml    # Agent + Frontend containers
  ARCHITECTURE.md       # Detailed architecture docs
```

### Agent System

- **ConversationAgent**: Main chat interface. Uses LangGraph with 82+ tools across 16+ categories (calendar, tasks, goals, aspects, notes, projects, reminders, memory, search, friends, shared-events, shared-aspects, suggestions, rules, interactions, profile). Powered by GPT-5.4-mini with pgvector memory context.
- **PlannerAgent**: Decomposes goals into milestones and scheduling plans.
- **SchedulerAgent**: Automates task scheduling and calendar optimization.
- **ScribeAgent**: Researches and generates notes, daily digests, pattern scanning.
- **MaintenanceAgentMargaret**: Audits data hygiene -- flags items without aspects, suggests aspect merges/splits, proposes description updates.
- **OnboardingEnrichmentAgent**: Enriches context for new users during onboarding.

### Data Model

Core tables: `profile`, `aspects`, `events`, `tasks`, `goals`, `notes`, `rules`, `user_interactions`, `interaction_responses`, `user_activity_log`, `user_friendships`, `friend_aspects`.

Events, tasks, and goals link to aspects via `aspect_id` (UUID FK).

## Setup

### Prerequisites

- Docker and Docker Compose
- Supabase project (with service role key)
- OpenAI API key
- Tavily API key (for web search)
- Google OAuth credentials (for calendar sync)
- Microsoft OAuth credentials (optional, for Outlook calendar sync)

### Environment Variables

Create a `.env` file in the project root:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# AI
OPENAI_API_KEY=your-openai-key

# Search
TAVILY_API_KEY=your-tavily-key

# Google Calendar
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_MAPS_API_KEY=your-google-maps-key

# Microsoft Calendar (optional)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/oauth/callback

# Push Notifications
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_CONTACT_EMAIL=your-email

# Admin (gates the analytics dashboard)
ADMIN_USER_IDS=comma-separated-supabase-user-ids        # backend API gate
VITE_ADMIN_USER_IDS=comma-separated-supabase-user-ids   # frontend UI gate

# Frontend (Vite)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_AGENT_SERVICE_URL=http://localhost:8000
```

> Never commit real secrets. `.env` is git-ignored. The service role key bypasses RLS and must stay server-side only.

### Running

```bash
docker compose up -d
```

- Frontend: http://localhost:3000
- Agent API: http://localhost:8000

### Development

Frontend changes hot-reload via volume mounts. Agent changes require a rebuild:

```bash
docker compose build --no-cache agent && docker compose up -d agent
```

## Security

- All API endpoints sit behind Supabase JWT authentication (`authenticateRequest` middleware).
- Every table enforces Row Level Security; the service role key is used only by the backend.
- CORS rejects unknown origins in production; requests are rate-limited and payloads size-capped.
- The admin analytics dashboard is gated by an explicit `ADMIN_USER_IDS` allowlist.
