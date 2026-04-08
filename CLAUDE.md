# Glyde - CLAUDE.md

## Project Overview

Glyde is an AI-native life management system. Monorepo with two apps:
- `apps/agents` - Node.js/Express backend with LangGraph agents (port 8000)
- `apps/frontend` - React/Vite frontend with TailwindCSS (port 5173, exposed on 3000)

Database: Supabase PostgreSQL with RLS. Memory: pgvector + fact extraction. AI: OpenAI GPT-5.4 family (mini for user-facing, nano for background).

## Critical Rules

### 1. Code Organization
- Many small files over few large files
- High cohesion, low coupling
- 200-400 lines typical, 800 max per file
- Organize by feature/domain, not by type

### 2. Code Style
- No emojis in code, comments, or documentation
- Immutability always - never mutate objects or arrays
- No console.log in production code (agents use structured logging)
- Proper error handling with try/catch
- Input validation with Zod or similar

### 3. Testing
- TDD: Write tests first
- 80% minimum coverage
- Unit tests for utilities
- Integration tests for APIs
- E2E tests for critical flows

### 4. Security
- No hardcoded secrets
- Environment variables for sensitive data
- Validate all user inputs
- Parameterized queries only (Supabase client handles this)
- All tables have RLS policies

### 5. TypeScript Imports (CRITICAL)
- With `isolatedModules: true` in frontend, always use `import type { ... }` for type-only imports
- Value imports of interfaces cause white screen with no build error
- Backend uses `.js` extensions in imports (Node ESM)

## File Structure

```
apps/agents/src/
  agents/
    AgentRegistry.ts     # Central registry for all agents
    base/                # BaseAgent abstract class
    conversation/        # Main ConversationAgent (LangGraph, 70+ tools)
    interaction-gerald/  # DISCONNECTED - role eliminated
    maintenance-margaret/ # Data hygiene auditor
    onboarding-enrichment/ # Onboarding context enrichment agent
  api/                   # 26 endpoint modules + middleware
    server.ts            # Express server
    middleware/auth.ts   # Auth middleware
    aspects.ts, events.ts, tasks.ts, goals.ts, notes.ts
    projects.ts, reminders.ts, rules.ts, interactions.ts, ratings.ts
    chat.ts, chat-history.ts, agent.ts, stream.ts
    calendar.ts, connections.ts, friendships.ts
    shared-aspects.ts, shared-events.ts
    user.ts, profile.ts, onboarding.ts, push.ts, analytics.ts
  services/              # 16+ specialized services
    SupabaseService.ts   # Primary data access layer
    AspectService.ts, ProfileService.ts, OnboardingService.ts
    CalendarMappingService.ts, CalendarIntegrationService.ts
    CalendarAnalysisService.ts
    GoogleCalendarSyncService.ts, MicrosoftCalendarSyncService.ts
    ConnectionService.ts, RuleService.ts
    FriendshipService.ts, SharedEventService.ts, SharedAspectService.ts
    ProjectService.ts, ReminderService.ts
    PushNotificationService.ts
    ZepMemoryService.ts, ZepGraphService.ts, ZepOnboardingSeedService.ts
  tools/                 # 70+ LangGraph tools across 15 categories
    ToolRegistry.ts      # Singleton tool registry
    aspects/ (5)         # create, update, list, archive, delete
    calendar/ (12)       # create, update, delete, recurring, analyze, free-time, search, bulk
    tasks/ (6)           # create, update, delete, complete, list, search
    goals/ (5)           # create, update, delete, check-in, list
    projects/ (7)        # create, update, delete, list, archive, unarchive, tag
    reminders/ (4)       # create, update, delete, list
    friends/ (9)         # send-request, accept, decline, list, remove, aspects, notes
    shared-events/ (4)   # add/remove member, get members, update role
    interactions/ (2)    # create-interaction, create-rating
    notes/ (3)           # create, get, update
    memory/ (3)          # search-unified, update-advanced, manage-patterns
    profile/ (2)         # get-profile, update-profile
    plans/ (2)           # get-plan, update-plan
    rules/ (4)           # create, list, delete, toggle
    search/ (2)          # web-search, location-search
  config/
    agents.ts            # Agent config (model: gpt-5.4-mini, recursionLimit: 10)
  types/                 # 8 type modules
    database.ts, agents.ts, api.ts, graph.ts, profile.ts, routing.ts
    express.d.ts, zep-ontology.ts
  utils/                 # 14 utility modules
    aspect-helpers.ts, event-helpers.ts, task-helpers.ts, goal-helpers.ts
    supabase.ts, env.ts, logger.ts
    rrule.ts, microsoftRecurrence.ts, timezoneUtils.ts, windowsTimezones.ts
    timeSlotFinder.ts, zep-sync-helper.ts
  jobs/                  # 10 background jobs (Zep maintenance, notifications, reminders)
  scripts/               # Zep cleanup utilities
  evals/                 # Agent evaluation framework (Gerald evals inactive)

apps/frontend/src/
  pages/                 # 13 pages
    CalendarPage.tsx, NotesPage.tsx, ProfilePage.tsx, ProfileEditPage.tsx
    AspectsPage.tsx, GoalsPage.tsx, ProjectsPage.tsx, FriendsPage.tsx
    RemindersPage.tsx, RatingsPage.tsx, ConnectionsPage.tsx
    AdminAnalyticsPage.tsx, OAuthCallbackPage.tsx
  components/            # 40+ components
    Calendar.tsx, ChatBot.tsx, TodoList.tsx, GlobalSearch.tsx
    FriendsSection.tsx, Auth.tsx, Modal.tsx, ProtectedRoute.tsx
    event/               # Event form, recurrence, sharing (6 files)
    mobile/              # Mobile calendar, header, pickers (6 files)
    profile/             # Profile cards and editors (6 files)
    onboarding/          # Onboarding flow with steps (4+ files)
    charts/              # Analytics charts
    ui/                  # UI primitives (button, popover, color picker, etc.)
  lib/                   # 28 API clients and utilities
    authContext.tsx, aspectContext.tsx, connectionContext.tsx
    projectContext.tsx, ruleContext.tsx, themeContext.tsx, timezoneContext.tsx
    aspectService.ts, calendarService.ts, taskService.ts, goalService.ts
    projectService.ts, profileService.ts, friendshipService.ts
    ruleService.ts, remindersService.ts, notesService.ts
    connectionService.ts, sharedAspectService.ts, sharedEventService.ts
    onboardingService.ts, searchService.ts, pushNotificationService.ts
    ratingService.ts, avatarService.ts
    supabase.ts, apiConfig.ts, apiUtils.ts
    calendarLayoutUtils.ts, timelineUtils.ts, recurrenceUtils.ts
  hooks/                 # 5 custom hooks
    useAvatarUpload.ts, useGeolocation.ts, useKeyboard.ts
    usePlatform.ts, useProfileData.ts
  styles/                # colors.ts, typography.ts, mobileStyles.ts
```

## Key Patterns

### Aspect System
Aspects are color-coded life categories (Work, Health, Personal, etc.). Stored in `aspects` table. Events, tasks, and goals link via `aspect_id` (UUID FK). The deprecated `category` text column still exists on some tables.

### ToolRegistry (Singleton)
```typescript
const registry = ToolRegistry.getInstance();
const tools = registry.getAllTools();           // ConversationAgent tools
// Gerald disconnected - getGeraldAgentTools() returns empty array
```

### Agent Prompt Pattern
Each agent has a `prompts.ts` with:
- A `PromptContext` interface defining required context fields
- A `buildXxxSystemPrompt(context)` function returning a `SystemMessage`
- Context includes: timezone, eventContext, taskContext, goalContext, aspectContext, profileContext

### Supabase RPC
Data retrieval uses RPC functions for joined data:
- `get_events_with_aspects` - Events with aspect name/color
- `get_tasks_with_aspects` - Tasks with aspect data
- `get_goals_with_aspects` - Goals with aspect data

### API Response Format
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

## Environment Variables

### Agent Service
```bash
SUPABASE_URL=             # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY= # Service role key (bypasses RLS)
SUPABASE_ANON_KEY=        # Anon key for client operations
OPENAI_API_KEY=           # OpenAI API key (GPT-5.1)
ZEP_API_KEY=              # Zep Cloud API key
ZEP_BASE_URL=             # Zep API base URL
TAVILY_API_KEY=           # Tavily web search API key
GOOGLE_CLIENT_ID=         # Google OAuth client ID
GOOGLE_CLIENT_SECRET=     # Google OAuth client secret
GOOGLE_REDIRECT_URI=      # OAuth redirect URI
```

### Frontend
```bash
VITE_SUPABASE_URL=        # Same as SUPABASE_URL
VITE_SUPABASE_ANON_KEY=   # Same as SUPABASE_ANON_KEY
VITE_AGENT_SERVICE_URL=   # Agent API URL (http://localhost:8000)
```

## Development

```bash
# Start everything
docker compose up -d

# Frontend hot-reloads via volume mounts
# Agent requires rebuild for changes:
docker compose build --no-cache agent && docker compose up -d agent

# Clean restart a service:
docker compose down agent && docker compose up -d agent
```

- Frontend: http://localhost:3000
- Agent API: http://localhost:8000

## Git Workflow

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Never commit to main directly
- PRs require review
- All tests must pass before merge
