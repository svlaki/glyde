# Glyde - Technical Overview

Glyde is an AI-native life management platform that unifies calendar scheduling, task management, goal tracking, note-taking, and social coordination under a single intelligent system. Users interact with Glyde through natural language conversation, and the system autonomously executes actions across all domains -- creating events, managing tasks, tracking goals, and proactively suggesting optimizations to their schedule and habits.

The platform is built as a monorepo with two primary applications: a Node.js agent backend powered by LangGraph and OpenAI GPT-5.1, and a React frontend with full cross-platform support (web, iOS, Android, desktop). Supabase PostgreSQL serves as the structured data layer, Zep Cloud provides persistent semantic memory and knowledge graphs, and external calendar providers (Google, Microsoft) sync bidirectionally.

---

## System Architecture

### High-Level Topology

```
Clients (Web / iOS / Android / Electron)
    |
    v
Frontend (React 19 + Vite + TailwindCSS) -- port 3000
    |
    v
Agent API (Express + LangGraph) -- port 8000
    |
    +---> Supabase PostgreSQL (structured data, RLS-enforced)
    +---> Zep Cloud (semantic memory, knowledge graph)
    +---> OpenAI GPT-5.1 (reasoning engine)
    +---> Google Calendar API (bidirectional sync)
    +---> Microsoft Graph API (bidirectional sync)
    +---> Tavily API (web search)
```

The frontend never communicates directly with LLM providers. All AI operations route through the agent API, which acts as both an API gateway and an intelligent orchestration layer. The frontend reads structured data directly from Supabase via the client SDK (with Row-Level Security enforcing isolation), but all mutations flow through the agent API to ensure activity logging, validation, and agent awareness of changes.

### Containerized Deployment

Docker Compose orchestrates two services:

- **Agent Service** (`glydeeee-agents`): Node.js 18 Alpine container running the compiled TypeScript backend. Receives all API calls from the frontend, executes LangGraph agent workflows, manages external integrations, and runs background jobs.

- **Frontend Service** (`glydeeee-frontend`): In development, a Node.js 20 container running Vite's dev server with volume-mounted source for hot reload. In production, a multi-stage build produces a static bundle served by Nginx.

The frontend hot-reloads via volume mounts. The agent service requires a Docker rebuild (`docker compose build --no-cache agent`) for code changes to take effect.

---

## Multi-Agent Orchestration

Glyde employs a multi-agent architecture where specialized agents handle different interaction modes. All agents are registered in a central AgentRegistry (singleton pattern) and communicate through a delegation protocol.

### Conversation Agent (Primary)

The Conversation Agent is the main user-facing agent. It processes all natural language input through a LangGraph state graph with access to 70+ tools across 15 categories. The agent employs a "bias to action" approach: when user intent is clear, it executes immediately without asking for confirmation.

The agent uses a conditional prompt assembly system. A ContextRouter analyzes each message and determines which prompt sections to include (calendar detail, goal creation, recurring events, location search, memory management, etc.) and whether to use `summary` mode (minimal context, fast) or `full` mode (complete context for complex operations). This keeps token usage efficient while ensuring the agent has what it needs for any given query.

The prompt system includes awareness of recent user activity (from the activity log), preventing the agent from duplicating actions the user just took manually. It also supports multi-action sequencing -- batching independent actions in parallel while waiting for dependent ones.

Key capabilities include: parsing pasted documents (syllabi, course schedules) into calendar events, cross-domain queries ("what do I have related to health this week?"), and context-aware scheduling that considers existing commitments, energy patterns, and user preferences.

### Interaction Agent (Gerald) - Proactive Suggestions

Gerald operates independently from the Conversation Agent with a restricted tool set. It generates proactive suggestions in two modes:

- **GENERATE mode**: Analyzes user context (upcoming events, pending tasks, goal progress, behavioral patterns) and creates interaction suggestions. These can be yes/no questions ("Want to schedule a workout tomorrow morning?"), multiple choice options, text prompts, ratings (1-10 scales), or time suggestions.

- **RESPONSE mode**: When a user responds to an interaction, Gerald processes the response and executes the appropriate tools (creating events, updating tasks, etc.).

Gerald draws from 100+ interaction types spanning schedule suggestions, task creation, goal nudges, miscategorization fixes, and aspect tagging. It maintains its own interaction history to avoid repeating suggestions and learns from user acceptance/rejection patterns.

### Scheduler Agent - Intelligent Slot Placement

The Scheduler Agent manages the suggestion slot system. It operates on a two-layer model:

1. **Action Suggestions** (the "what"): A backlog of things the user could do -- goal steps, task work, habit building, preparation for upcoming events.

2. **Placement Slots** (the "when"): Calendar slots where suggestions are scheduled into free time windows.

The scheduling intelligence considers: time-of-day energy matching (high-energy tasks in morning/afternoon, low-energy in evening), aspect variety (spreading across life areas), context gaps (30-minute buffers between events), day spread (max 3-4 suggestions per day), feedback learning (honoring prior dismissals), and task urgency weighted by goal progress.

### Maintenance Agent (Margaret) - Data Hygiene

Margaret audits data quality without taking direct action. She analyzes categorization accuracy, aspect maintenance needs, and description freshness, then presents evidence-based suggestions for user confirmation. Every suggestion cites specific items and explains the reasoning.

### Planner Agent - Life Planning

Manages long-term life plans and integrates goals into a cohesive planning framework using dedicated plan tools.

### Onboarding Enrichment Agent

Guides new users through initial setup, collecting contextual information and seeding the Zep knowledge graph with foundational facts about the user's life, preferences, and goals.

---

## Tool System

The ToolRegistry is a singleton that manages 70+ LangChain-compatible tools organized into 15 categories. Each tool has a Zod schema for input validation, a description for the LLM, and an execute function. The registry provides different tool subsets for different agents (the Conversation Agent gets all tools; Gerald gets a restricted set to prevent unintended side effects).

### Calendar Tools (12)

Full calendar lifecycle management: single and recurring event creation, updates with scope control (entire series, single instance, all future), deletion with automatic recurring series detection, event search, schedule analysis, free time finding, and bulk operations. Recurring events use RFC 5545 RRULE format with support for DAILY, WEEKLY, MONTHLY, and YEARLY frequencies.

### Task Tools (7)

Task CRUD with priority levels (urgent, high, medium, low), due dates, aspect association, completion tracking, and full-text search. Tasks integrate with the goal system through `parent_goal_id` linking.

### Goal Tools (6)

Goal creation requires a minimum of 3 milestones, ensuring goals are actionable rather than aspirational. Goals track progress (0-100%), support check-ins, and link to aspects for categorization. The system includes life plan integration through dedicated plan tools.

### Aspect Tools (5)

Aspects are Glyde's categorization system -- color-coded life areas (Work, Health, Personal, Social, etc.) that thread through every domain object. Tools handle creation (with color and description), updates, listing, archiving (with cascade effects on linked items), and deletion.

When an aspect is archived, the system cascades: active tasks are cancelled, active goals are paused, recurring event series end, future non-recurring events are deleted, pending reminders are dismissed, and calendar mappings are nullified. All RPC functions filter out items linked to archived aspects at the database level.

### Memory Tools (3)

Interface to the Zep knowledge graph: unified search across personal and community memory, advanced memory updates with importance levels (high/medium/low), and behavioral pattern management with confidence scoring.

### Suggestion Tools (6)

Manage the two-layer suggestion system: create action suggestions (backlog), list open suggestions, create placement slots (schedule into calendar with conflict detection), confirm slots (accept and create events), dismiss slots (reject and return to backlog), and swap slots to random free times.

### Friend Tools (10)

Full social graph management: send/accept/decline friend requests, list friends, remove connections, associate aspects with friends, and maintain friend notes.

### Additional Tool Categories

- **Shared Events** (4): Multi-user event coordination with role-based access (viewer/editor)
- **Profile** (3): User profile retrieval and updates (timezone, preferences, communication style)
- **Project** (7): Project lifecycle including archive/unarchive and entity tagging
- **Rule** (5): Automation rule creation, toggling, and management
- **Reminder** (5): Time-based notification creation with snooze support
- **Note** (4): Note CRUD with wiki-link support
- **Search** (2): Web search (via Tavily) and location search (GPS-aware venue/drive time finding)
- **Interaction** (2): Gerald-specific tools for creating interactions and ratings

---

## Data Architecture

### Supabase PostgreSQL

All data lives in a Supabase-hosted PostgreSQL database with Row-Level Security (RLS) enforced on every table. The RLS pattern is consistent: `auth.uid() = user_id` ensures complete tenant isolation at the database level.

**Core Domain Tables:**

| Table | Purpose |
|-------|---------|
| `events` | Calendar events with recurrence, visibility, external sync IDs, aspect linkage |
| `tasks` | To-do items with priority, due date, completion tracking, goal linkage |
| `goals` | Life goals with milestones (JSONB), progress tracking, review frequency |
| `notes` | Rich text notes with aspect association and full-text search |
| `aspects` | Color-coded life categories with archive support |
| `projects` | Project containers with deadlines, aspect linkage, archive support |
| `rules` | User-defined automation rules (if-then conditions) |
| `reminders` | Time-triggered notifications |
| `profile` | User metadata, timezone, preferences, AI context (650+ structured fields) |

**Social & Sharing Tables:**

| Table | Purpose |
|-------|---------|
| `user_friendships` | Friend connections with status (pending/accepted/declined) |
| `shared_aspect_members` | Aspect sharing between friends |
| `user_friend_visibility_settings` | Per-friend event visibility controls |

**Infrastructure Tables:**

| Table | Purpose |
|-------|---------|
| `user_activity_log` | Audit trail for every mutation (entity type, operation, old/new values, source) |
| `user_connections` | OAuth credentials for Google/Microsoft calendar sync |
| `user_calendar_mappings` | External calendar-to-aspect mapping |
| `action_suggestions` | Suggestion backlog for the slot system |
| `suggestion_slots` | Scheduled suggestion placements |
| `push_notification_devices` | Mobile device tokens for push notifications |
| `note_links` | Wiki-link graph edges between notes |
| `chat_messages` | Conversation history (fallback for Zep) |
| `recurring_event_exceptions` | Instance-level overrides for recurring events |

**RPC Functions:**

Data retrieval uses PostgreSQL RPC functions that join domain tables with aspects for color/name/icon data:
- `get_events_with_aspects` - Events with aspect metadata, archived aspect filtering
- `get_tasks_with_aspects` - Tasks with aspect data, archived filtering
- `get_goals_with_aspects` - Goals with aspect data, archived filtering
- `get_projects_with_aspects` - Projects with aspect data, archived filtering
- `get_friends_events` - Friend events with visibility and archived aspect filtering

All RPC functions exclude items linked to archived aspects via `(aspect_id IS NULL OR a.archived_at IS NULL)`.

### AI Context Profile

The user profile includes a structured AI context with 650+ fields organized into 10 sections:

- **Life Context**: Core values, life phase, major commitments, short/medium/long-term goals
- **Work Context**: Role, company, working hours with flexibility, focus areas, collaborators
- **Productivity Context**: Peak focus hours, energy patterns (morning/afternoon/evening), optimal session length, distraction triggers
- **Health Context**: Exercise routine, sleep schedule, nutrition, mental health
- **Relationships Context**: Important people with contact frequency, social needs
- **Routines Context**: Morning/evening routines, weekly patterns
- **Decision Making Context**: Risk tolerance, planning style, prioritization method
- **Communication Context**: Meeting preferences, response expectations, tone preference
- **Learning Context**: Current learning goals, style, skill development areas
- **Agent Preferences**: Proactivity level, suggestion frequency, notification style, confirmation requirements

This profile is built progressively through conversation and onboarding, and informs every agent decision.

### Zep Cloud - Semantic Memory & Knowledge Graph

Glyde uses a dual-memory architecture:

**Structured Memory (Supabase):** Source of truth for all entities -- events, tasks, goals, aspects. The activity log tracks every change with old/new values, enabling undo awareness and preventing the agent from duplicating manual user actions.

**Unstructured Memory (Zep Cloud):** Three layers of persistent memory:

1. **Vector Memory**: Chat history with embeddings for semantic search. Enables the agent to recall past conversations and context across sessions.

2. **Graph Memory**: A custom ontology of entity types (CalendarEvent, Task, Goal, Pattern, TimeBlock, UserPreference) with typed relationships. Facts are extracted from conversations and stored with confidence scores.

3. **Dual-Graph Architecture**: Per-user graphs store individual facts and patterns. A central group graph aggregates cross-user intelligence for community-level pattern detection.

**Pattern Extraction**: A weekly background job analyzes user behavior and extracts scheduling patterns (time-of-day preferences, day-of-week preferences, duration patterns) and productivity patterns (completion rates by priority, best times, category completion). Patterns include confidence scores (0-1) and are stored in both Zep and the `user_patterns` table.

**Reconciliation**: Background jobs keep Zep and Supabase in sync -- reconciling facts with the database truth, cleaning up orphaned facts for deleted entities, retrying failed operations from a dead-letter queue, and periodically rebuilding user graphs from scratch.

---

## Calendar Integration

### Google Calendar Sync

Bidirectional sync with Google Calendar follows this flow:

1. **OAuth**: User initiates connection, redirects to Google consent screen
2. **Token Exchange**: Authorization code exchanged for access + refresh tokens, stored in `user_connections`
3. **Initial Sync**: Fetches last 3 months of events, stores with a `syncToken` for incremental updates
4. **Delta Sync**: Uses the sync token to fetch only changes since last sync. Handles token expiration (410 Gone) by falling back to full re-sync
5. **Webhook Notifications**: Google sends push notifications to the agent API when events change, triggering immediate delta sync
6. **Watch Renewal**: A background job renews webhook subscriptions before they expire

Users select which Google calendars to sync via the Connections page. Calendar mappings track which external calendars are included and optionally map them to Glyde aspects.

### Microsoft Calendar Sync

Follows the same pattern via Microsoft Graph API with OAuth to `login.microsoftonline.com`. Supports the same initial/delta sync model and webhook notifications.

---

## Social System

### Friendships

Users connect by sending friend requests via email. The `user_friendships` table tracks relationship status (pending, accepted, declined). Once connected, users can:

- View each other's events (controlled by per-event visibility: private, friends, public)
- Share entire aspect categories, giving friends read or edit access to all items in that aspect
- Add friend-specific notes for context
- Control per-friend event visibility via settings

### Shared Events

Events can include multiple attendees with role-based access:
- **Viewer**: Can see the event but not modify it
- **Editor**: Can modify event details

The `get_friends_events` RPC function respects visibility settings and friendship status, and filters out events from archived aspects.

### Shared Aspects

An aspect owner can share the entire category with friends. The `shared_aspect_members` table tracks membership with roles (owner, editor, viewer). Shared aspects appear in both users' aspect lists with role indicators.

---

## Suggestion Slot System

The suggestion system is a two-layer architecture designed to proactively optimize the user's schedule:

### Layer 1: Action Suggestions (Backlog)

Suggestions are generated by the Scheduler Agent or user conversation. Each suggestion has:
- Title and description
- Type: `goal_step`, `task_step`, `prep_step`, `habit`, `general`
- Estimated duration in minutes
- Energy level required
- Source aspect and linked entity (goal/task)

### Layer 2: Placement Slots (Calendar)

The Scheduler Agent finds free time windows and places suggestions into them. Placement considers:
- **Energy matching**: High-energy suggestions in peak hours, low-energy in wind-down periods
- **Aspect variety**: Spreading across different life areas within a day
- **Context buffers**: 30-minute gaps between events
- **Day load**: Maximum 3-4 suggestion slots per day
- **Feedback learning**: De-prioritizing suggestion types the user frequently dismisses
- **Urgency weighting**: Task deadlines and goal progress inform priority

### User Interaction

The frontend displays suggestion slots on the calendar with a distinctive checkerboard pattern in the aspect's color. Users can:
- **Confirm**: Accepts the suggestion, creating a real calendar event
- **Dismiss**: Rejects the slot, returning the suggestion to the backlog
- **Swap**: Moves the slot to a different random free time window
- **Navigate**: Cycle through queued suggestions within a slot

---

## Notes & Knowledge Graph

### Note System

Notes support rich text editing via Tiptap with Markdown extensions. Each note is associated with an aspect for color-coded categorization. The system supports:

- **Wiki-Links**: `[[Note Title]]` syntax creates bidirectional links between notes. The `syncNoteLinks` function parses note content for wiki-link patterns and maintains edges in the `note_links` table.
- **Backlinks**: Any note can see which other notes reference it via `getBacklinks`.
- **Full-Text Search**: PostgreSQL full-text search index on note content.
- **Templates**: Reusable note templates for consistent structure.

### Knowledge Graph Visualization

An SVG-based interactive graph renders the relationships between notes, aspects, and goals:

- **Node types**: Aspects (colored circles), Goals (5-point stars), Notes (small circles)
- **Link types**: Solid lines (explicit wiki-links), dashed lines (implicit same-aspect affinity)
- **Interactions**: Pan/zoom, node dragging with debounced position persistence, double-click to create links, context menus for archiving/deleting, legend popup
- **Visual feedback**: Hover highlighting dims unrelated nodes and emphasizes connected links

---

## Frontend Architecture

### Technology Stack

React 19 with Vite for bundling, TailwindCSS for utility styles, and inline styles driven by a theme context for dynamic theming. The application supports web, native mobile (iOS/Android via Capacitor), and desktop (Electron).

### Provider Architecture

The app wraps in a cascading provider chain:
```
AuthProvider > ThemeProvider > RuleProvider > ConnectionProvider > AspectProvider > ProjectProvider
```

Each provider manages domain-specific state and exposes it via React context hooks.

### Theming

11 theme families with light and dark variants (22 total themes):

Classic, Nord, Tokyo, Ember, Ocean, Solar, Midnight, Forest, Sakura, Cyber, Dune

Each theme defines a complete color token set: background (primary/secondary/tertiary/hover), text (primary/secondary/tertiary), UI (border/accent), and status colors (error/success/warning). Theme selection persists in localStorage and syncs CSS variables for shadcn/ui components.

### Typography

Three font families: Inter (sans, body/UI), EB Garamond (serif, headings), SF Mono (monospace, code). Responsive scaling adjusts sizes between desktop and mobile ranges. Input fields use 16px minimum on iOS to prevent zoom-on-focus.

### Responsive Design

The `usePlatform` hook detects the runtime environment (web, iOS, Android, Electron) and returns platform flags. Components conditionally render different layouts:

- **Desktop**: Collapsible vertical sidebar (52px collapsed, 280px expanded) + main content area + optional side panels
- **Mobile**: Full-screen pages with MobileHeader (back button, title, actions) + bottom tab navigation
- **Touch optimization**: 44px minimum touch targets, long-press for drag (400ms), haptic feedback, safe area insets

### Key Components

- **Calendar**: Multi-view rendering (week/month), drag-to-reschedule, suggestion slot overlay, friend event display, real-time Supabase subscriptions for live updates
- **ChatBot**: AI conversation interface connected to the agent API with streaming support
- **TodoList**: Aspect-colored task list with priority badges, drag-drop reordering (desktop), agent-triggered refresh via custom events
- **GlobalSearch**: Cmd+K/Ctrl+K modal with debounced cross-entity search (events, tasks, goals), keyboard navigation, type filtering
- **VerticalSidebar**: Collapsible navigation with grouped sections (Calendar, Organize, Track, Connect), theme picker, and search trigger

### Pages

| Page | Features |
|------|----------|
| Calendar | Week/month views, event creation/editing, calendar sync status, suggestion slots, friend events |
| Notes | Tiptap rich text editor, wiki-links, knowledge graph visualization, full-text search, backlinks, templates |
| Aspects | Color-coded category management, Active/Archived tabs, drag-drop reordering, archive with cascade |
| Goals | Goal creation with mandatory milestones, progress tracking, check-ins, aspect association |
| Projects | Project containers with deadlines, entity linking (events/tasks/goals), archive support |
| Ratings | 1-10 scale rating entry, history and trends, customizable topic management |
| Reminders | Time-based notification management with snooze |
| Friends | Friend requests, friend list, aspect sharing, friend notes, event visibility controls |
| Connections | Google/Microsoft calendar OAuth, sync controls, calendar selection |
| Profile | User metadata display and editing, preferences, communication style, work hours |
| Admin Analytics | Admin-only dashboard (lazy-loaded) |

---

## Background Jobs

The agent service runs several background jobs:

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Reminder Checker | Every 5 min | Checks reminders due in next 5 minutes, triggers push notifications |
| Notification Scheduler | Periodic | Batches push notifications for efficiency, handles device token management |
| Watch Renewal | Periodic | Renews Google Calendar webhook subscriptions before expiration |
| Zep Pattern Extraction | Weekly | Analyzes user behavior, extracts scheduling and productivity patterns with confidence scores |
| Zep Reconciliation | Periodic | Syncs Zep facts with Supabase truth, consolidates duplicates |
| Zep Full Rebuild | On-demand | Rebuilds entire user Zep graph from Supabase data |
| Zep Dead Letter Retry | Periodic | Retries failed Zep operations from dead-letter queue |
| Zep Orphan Cleanup | Periodic | Removes Zep facts for deleted entities |

---

## Evaluation System

An evaluation framework for the Interaction Agent (Gerald) tests suggestion quality:

1. **Data Loader**: Loads real user data from the database as test fixtures
2. **Context Builder**: Constructs Gerald's context from test data
3. **Interaction Generator**: Generates test interactions for Gerald to evaluate
4. **Response Simulator**: Simulates user responses (accept/reject) to test response handling
5. **Judge**: Scores Gerald's suggestions on relevance, actionability, and timing
6. **Report Generator**: Produces evaluation reports with metrics

---

## Push Notifications

Mobile push notifications flow through:

1. Frontend registers device token (FCM for Android, APNs for iOS) via Capacitor
2. Token stored in `push_notification_devices` table
3. Reminder Checker job identifies due reminders
4. `PushNotificationService` sends notifications to registered devices
5. Token refresh and invalidation handled automatically

---

## Service Layer

21 specialized services encapsulate business logic:

**Data Services**: SupabaseService (primary data layer, 120KB), AspectService, ProfileService, ProjectService, RuleService, ReminderService, SuggestionService

**Calendar Services**: CalendarIntegrationService (orchestration), GoogleCalendarSyncService (21KB), MicrosoftCalendarSyncService (20KB), CalendarMappingService (33KB), CalendarAnalysisService

**Social Services**: FriendshipService (30KB), SharedEventService, SharedAspectService

**Memory Services**: ZepMemoryService (thread/context), ZepGraphService (24KB, knowledge graph with custom ontology), ZepOnboardingSeedService

**Infrastructure Services**: ConnectionService (OAuth management), PushNotificationService, OnboardingService

---

## Type System

Strict TypeScript throughout with separate type modules:

- **database.ts**: Database row types (DatabaseEvent with 20+ fields, DatabaseAspect, DatabaseTask, etc.)
- **agents.ts**: Agent runtime types (AgentContext, AgentResponse, UserProfile, BehaviorInsight, MemoryContext)
- **graph.ts**: Zep ontology types (entity types, edge types, graph structures)
- **routing.ts**: Agent routing (ToolCategory, PromptSection, ContextMode, RoutingDecision)
- **profile.ts**: AI Context Profile (650+ structured fields across 10 life domains)
- **zep-ontology.ts**: Zep entity and relationship definitions

The frontend enforces `isolatedModules: true`, requiring `import type { }` for type-only imports to prevent runtime errors from interface imports being stripped by esbuild.

---

## Security Model

- **Row-Level Security**: Every Supabase table has RLS policies enforcing `user_id = auth.uid()`
- **JWT Authentication**: All agent API requests require a valid Supabase JWT in the Authorization header
- **Service Role Isolation**: The agent backend uses the Supabase service role key (bypassing RLS) only for cross-user operations; all user-scoped queries pass through RLS
- **Input Validation**: Zod schemas validate all tool inputs; API endpoints sanitize user input
- **Rate Limiting**: In-memory rate limiter (configurable: 300 requests per 60-second window)
- **CORS**: Restricted to known origins (localhost, Capacitor, Railway deployment URL)
- **OAuth Token Management**: Refresh tokens stored encrypted; access tokens refreshed automatically on expiration
- **No Hardcoded Secrets**: All sensitive values via environment variables with Zod validation on startup

---

## Environment Configuration

### Agent Service
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
OPENAI_API_KEY (GPT-5.1)
ZEP_API_KEY, ZEP_BASE_URL
TAVILY_API_KEY (web search)
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI
PORT (8000), NODE_ENV, FRONTEND_URL
RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS
ADMIN_USER_IDS
```

### Frontend
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
VITE_AGENT_SERVICE_URL (http://localhost:8000)
VITE_GOOGLE_CLIENT_ID
VITE_ADMIN_USER_IDS
```

---

## Key Architectural Patterns

1. **Aspect-Centric Data Model**: Every domain object (event, task, goal, note, project) links to an aspect via `aspect_id`. This enables cross-domain views ("show me everything related to Health"), consistent color coding, and cascading archive behavior.

2. **Tool-Based Agent Design**: Agents don't implement business logic directly. They select tools from the registry based on user intent, and tools execute via service layer calls. Adding a new capability means adding a tool, not modifying agent code.

3. **Conditional Prompt Assembly**: System prompts are built from modular sections, included only when relevant. A ContextRouter classifies each message to determine which sections and how much context to include, balancing comprehensiveness with token efficiency.

4. **Activity-Aware Agents**: The activity log records every mutation with source attribution (user vs. agent). The Conversation Agent reads recent activity before responding, preventing it from duplicating actions the user just performed manually.

5. **Dual Memory Architecture**: Structured data (Supabase) is the source of truth for entities. Unstructured memory (Zep) stores semantic context, behavioral patterns, and cross-session insights. Reconciliation jobs keep them aligned.

6. **Two-Layer Suggestion System**: Separating "what" (action suggestions) from "when" (placement slots) enables flexible scheduling. Suggestions persist in a backlog independent of calendar state, and the Scheduler Agent optimizes placement based on energy, variety, and feedback.

7. **Immutability-First Code Style**: No object or array mutations anywhere in the codebase. All transformations produce new values via spread operators and functional patterns.

8. **Database-Level Filtering**: Archived aspects, friend visibility, and access control are enforced in PostgreSQL RPC functions, not in application code. This ensures consistency across all consumers (frontend, agents, background jobs).
