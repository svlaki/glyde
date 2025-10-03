# Frontend Architecture Complete Analysis - January 2025

## Project Structure

```
apps/frontend/
├── src/
│   ├── pages/               # Main application pages
│   │   ├── CalendarPage.tsx    # FullCalendar week view with category system
│   │   ├── TasksPage.tsx       # Task management with categories
│   │   ├── GoalsPage.tsx       # Goal tracking with check-ins
│   │   ├── ProfilePage.tsx     # AI context profile management
│   │   └── CategoriesPage.tsx  # Category CRUD operations
│   ├── components/          # Reusable UI components
│   │   ├── MainLayout.tsx      # Hamburger menu navigation layout
│   │   ├── Auth.tsx            # Authentication component
│   │   ├── ProtectedRoute.tsx  # Route protection wrapper
│   │   ├── InteractionBox.tsx  # Legacy interaction component
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx   # AI chat interface with streaming
│   │   │   └── hooks/
│   │   │       └── useStreamingChat.ts  # Streaming chat hook
│   │   └── ui/                 # Shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       └── input.tsx
│   └── lib/                 # Services and utilities
│       ├── supabase.ts         # Supabase client
│       ├── authContext.tsx     # Authentication context
│       ├── interactionContext.tsx
│       ├── calendarService.ts  # Calendar API calls
│       ├── categoryService.ts  # Category API calls
│       ├── taskService.ts      # Task API calls
│       ├── goalService.ts      # Goal API calls
│       ├── profileService.ts   # Profile API calls
│       ├── agentInteractionHook.ts
│       └── utils.ts
├── .env                     # Environment variables
├── package.json
└── vite.config.ts

Docker: Host port 3000 maps to container port 5173
```

## Routing & Navigation

- **React Router v6** for client-side routing
- **MainLayout.tsx**: Hamburger menu with navigation to all pages
- **Routes**:
  - `/calendar` - Calendar page (FullCalendar)
  - `/tasks` - Tasks page
  - `/goals` - Goals page
  - `/profile` - Profile page
  - `/categories` - Categories page

## State Management

- **React Context API**: Used for auth (authContext.tsx, interactionContext.tsx)
- **Local State**: Each page manages its own state with useState
- **No Redux/Zustand**: Simple context-based architecture

## Backend Communication

All pages use service files (`lib/`) to communicate with:
- **Backend Agent Service**: `http://localhost:8000` (VITE_AGENT_SERVICE_URL)
- **Supabase Direct**: For auth and real-time subscriptions

## Key Features

### Calendar System (CalendarPage.tsx)
- FullCalendar library for week view
- Category-based event organization (12 categories)
- Event modal for create/edit
- Color-coded events by category
- REMOVED: Archetype system (replaced with categories)

### Chat System (ChatPanel.tsx)
- Streaming AI responses using llm-ui
- Markdown rendering with ReactMarkdown
- Session-based chat history
- Backend API integration for persistence

### Category System (CategoriesPage.tsx)
- Create/Edit/Delete categories
- Filter by applies_to (events/tasks/goals)
- Color picker with icon support
- AI context field (JSON)

### Profile System (ProfilePage.tsx)
- 11 profile sections (life, work, productivity, health, relationships, etc.)
- Completeness tracking per section
- JSON-based field editing
- AI context management

### Tasks System (TasksPage.tsx)
- Task CRUD with categories
- Priority levels (low/medium/high/urgent)
- Energy requirements
- Estimated duration
- Status filtering (pending/in_progress/completed)

### Goals System (GoalsPage.tsx)
- Goal CRUD with categories
- Progress tracking (0-100%)
- Goal types (SMART/OKR/Milestone/Habit/Project)
- Check-in system with mood/confidence ratings
- Review frequency settings

## Technology Stack

- **React 19** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **FullCalendar** for calendar display
- **ReactMarkdown** + remark-gfm for markdown rendering
- **@llm-ui/react** for streaming AI responses
- **Lucide React** for icons
- **Shadcn/ui** for UI components
- **Supabase** for backend/auth
- **React Router v6** for routing

## Current State (January 2025)

✅ Category system fully implemented (frontend + backend)
✅ Archetype system completely removed
✅ Docker setup working (localhost:3000)
✅ Chat panel with streaming responses
✅ All CRUD pages functional
✅ Navigation via hamburger menu
✅ Category integration in Calendar/Tasks/Goals

## Recent Changes

- Removed all archetype logic from CalendarPage.tsx (342+ lines)
- Replaced archetype forms with simple category dropdown
- Updated TypeScript interfaces to use category instead of archetype
- Simplified event modal to show category with color indicator
