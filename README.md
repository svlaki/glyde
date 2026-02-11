# Glyde

Glyde is an AI-native life management and coordination system. It centralizes a user's schedule, tasks, goals, and life plan around color-coded **aspects** -- flexible categories that organize every object in the system. A conversational agent handles most actions through natural language, automatically creating events, assigning aspects, filling in details, and keeping everything connected.

## Features

| Feature | Status |
|---|---|
| Aspects (color-coded life categories) | Built |
| Calendar (events, recurring events, Google Calendar sync) | Built |
| Tasks (to-do list with priorities, due dates, aspects) | Built |
| Goals (milestones, progress tracking, check-ins) | Built |
| Conversation Agent (30+ tools, natural language) | Built |
| Interaction Agent Gerald (proactive suggestions, follow-ups) | Built |
| Maintenance Agent Margaret (data hygiene audits) | Built |
| Life Plan (phases, timelines, embedded chat) | Built |
| Rules (user-defined agent behavior constraints) | Built |
| Social (friends, aspect tagging, public events) | Built |
| Zep Cloud memory (persistent user context) | Built |
| Web search enrichment (Tavily) | Built |
| Location tracking | Planned |
| Fitness tracking | Planned |
| Sleep tracking | Planned |

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, Framer Motion
- **Backend**: Node.js, Express, LangGraph, OpenAI GPT-5.1
- **Database**: Supabase (PostgreSQL with RLS)
- **Memory**: Zep Cloud (graph-based persistent memory)
- **Search**: Tavily API
- **Calendar**: Google Calendar API (OAuth2)
- **Infrastructure**: Docker Compose

## Architecture

```
glydeproper/
  apps/
    agents/             # Node.js backend (port 8000)
      src/
        agents/         # ConversationAgent, Gerald, Margaret
        api/            # Express routes (60+ endpoints)
        services/       # SupabaseService, AspectService, etc.
        tools/          # 55+ LangGraph tools (calendar, tasks, goals, aspects, ...)
        config/         # Agent configuration
    frontend/           # React/Vite frontend (port 5173, exposed on 3000)
      src/
        components/     # Calendar, ChatBot, Profile, Friends, etc.
        pages/          # PlanPage, ProfilePage
        lib/            # Services, contexts, utilities
        hooks/          # Custom React hooks
  docker-compose.yml    # Agent + Frontend containers
  ARCHITECTURE.md       # Detailed architecture docs
```

### Agent System

- **ConversationAgent**: Main chat interface. Uses LangGraph with 55+ tools across 11 categories (calendar, tasks, goals, aspects, profile, memory, search, interactions, rules, plans, social). Powered by GPT-5.1 with Zep memory context.
- **InteractionAgentGerald**: Generates proactive suggestions (scheduling, goal check-ins, task reminders) as yes/no or multiple-choice interactions with follow-up chaining.
- **MaintenanceAgentMargaret**: Audits data hygiene -- flags uncategorized items, suggests aspect merges/splits, proposes description updates.

### Data Model

Core tables: `profile`, `aspects`, `events`, `tasks`, `goals`, `life_plans`, `rules`, `user_interactions`, `interaction_responses`, `user_activity_log`, `user_friendships`, `friend_aspects`.

Events, tasks, and goals link to aspects via `aspect_id` (UUID FK). The deprecated `category` text column is still present for backward compatibility.

## Setup

### Prerequisites

- Docker and Docker Compose
- Supabase project (with service role key)
- OpenAI API key
- Zep Cloud API key
- Tavily API key (for web search)
- Google OAuth credentials (for calendar sync)

### Environment Variables

Create a `.env` file in the project root:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# AI
OPENAI_API_KEY=your-openai-key

# Memory
ZEP_API_KEY=your-zep-key
ZEP_BASE_URL=https://api.getzep.com

# Search
TAVILY_API_KEY=your-tavily-key

# Google Calendar (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
```

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
