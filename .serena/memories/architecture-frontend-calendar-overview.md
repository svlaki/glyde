# Frontend Calendar Architecture Overview

## Key Components & Data Flow

### 1. Calendar Page ([CalendarPage.tsx](apps/frontend/src/pages/CalendarPage.tsx))
**Main entry point for calendar functionality**

#### State Management:
- `events: ExtendedCalendarEvent[]` - Calendar events from backend
- `tasks: Task[]` - User tasks 
- `isModalOpen: boolean` - Controls EventModal visibility
- `selectedEvent: ExtendedCalendarEvent | null` - Currently selected/editing event
- `selectedDate: string | null` - Date clicked for new event creation
- `userTimezone: string` - User's timezone preference (default 'local')

#### Key Functions:
- `loadUserEvents()` - Fetches events from backend via calendarService
- `loadUserTasks()` - Fetches tasks from backend via taskService
- `handleDateClick(info)` - Opens modal for new event creation when user clicks a date
- `handleEventClick(info)` - Opens modal for event editing when user clicks existing event
- `handleCalendarEventUpdate()` - Handles drag/drop and resize operations
- `transformEvent()` - Converts CalendarEvent to ExtendedCalendarEvent with colors

#### Realtime Updates:
- Subscribes to Supabase realtime channel for events table changes
- Auto-reloads events when changes detected for current user

### 2. Type Definitions

#### ExtendedCalendarEvent ([types/calendar.ts](apps/frontend/src/types/calendar.ts))
```typescript
type ExtendedCalendarEvent = CalendarEvent & {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  start?: string;  // FullCalendar format
  end?: string;    // FullCalendar format
}
```

#### CalendarEvent ([lib/calendarService.ts](apps/frontend/src/lib/calendarService.ts))
```typescript
interface CalendarEvent {
  id: string
  user_id?: string
  title: string
  start_time: string  // ISO format from backend
  end_time: string    // ISO format from backend
  location?: string
  description?: string
  created_at?: string
  updated_at?: string
  category?: string
  color?: string
}
```

### 3. Calendar Service ([lib/calendarService.ts](apps/frontend/src/lib/calendarService.ts))
**API layer for calendar operations**

#### Functions:
- `fetchUserEvents(user, startDate?, endDate?)` - GET events from backend API
- `createEvent(user, event)` - POST to `/api/events/create`
- `updateEvent(user, eventId, event)` - POST to `/api/events/update`
- `deleteEvent(user, eventId)` - POST to `/api/events/delete`

**Important**: All functions use the agent service backend API (port 8000), NOT direct Supabase calls

### 4. EventModal Component (Embedded in CalendarPage.tsx)
**Modal dialog for creating/editing events**

#### Props:
- `isOpen: boolean`
- `onClose: () => void`
- `event: ExtendedCalendarEvent | null` - If editing existing event
- `date: string | null` - If creating new event
- `onSave: () => void` - Callback to reload events
- `user: { id, email }`
- `toast: ToastFunction`
- `userTimezone: string`

#### State:
- `title: string`
- `startTime: string` - HH:mm format in user's timezone
- `endTime: string` - HH:mm format in user's timezone
- `description: string`
- `category: string` - Maps to CATEGORY_COLORS

#### Timezone Handling:
- **Display**: Converts UTC times from backend to user timezone using `toZonedTime()`
- **Save**: Converts user timezone to UTC for backend using `fromZonedTime()`
- Uses `date-fns-tz` library for timezone conversions

### 5. FullCalendar Integration
**Third-party calendar component**

#### Configuration:
- **Initial View**: `timeGridWeek` (week view with time slots)
- **Timezone**: Uses `userTimezone` state
- **Plugins**: dayGrid, timeGrid, interaction
- **Editable**: true (drag/drop, resize enabled)
- **Event Handlers**:
  - `dateClick` → Opens modal for new event
  - `eventClick` → Opens modal for editing
  - `eventDrop` → Updates event times via API
  - `eventResize` → Updates event times via API

### 6. Missing Imports Issue
**CRITICAL BUG**: CalendarPage.tsx uses types/components that are NOT imported:
- `ExtendedCalendarEvent` - Used throughout but never imported
- `getCategoryColor()` - Called in transformEvent() but not defined
- `createEvent()` - Used in EventModal but not imported
- `deleteEvent()` - Used in EventModal but not imported
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` - UI components used in EventModal but not imported
- `Button`, `Input` - UI components used but not imported

### 7. Week View Configuration Issue
**Current**: FullCalendar starts week view with current date, showing full week
**Required**: Week view should always show "today" as the SECOND day (position 1, 0-indexed)

**Solution**: Add `validRange` or `initialDate` calculation to set start of week

## Data Flow Summary

1. **Page Load**:
   - Fetch user timezone from profile API
   - Fetch events via calendarService
   - Fetch tasks via taskService
   - Subscribe to realtime events channel

2. **Event Creation**:
   - User clicks date → `handleDateClick()` → Opens EventModal with date
   - User fills form → `handleSave()` → Calls `createEvent()` → Backend API
   - Modal closes → `loadUserEvents()` → Refreshes calendar

3. **Event Editing**:
   - User clicks event → `handleEventClick()` → Opens EventModal with event data
   - User edits form → `handleSave()` → Calls `updateEvent()` → Backend API
   - Modal closes → `loadUserEvents()` → Refreshes calendar

4. **Event Drag/Resize**:
   - User drags/resizes → `eventDrop`/`eventResize` handlers
   - Extract new times → `handleCalendarEventUpdate()` → Calls `updateEvent()`
   - On success → `loadUserEvents()` → Refreshes calendar

## Backend API Endpoints Used
- POST `/api/events` - Fetch events (with optional date range)
- POST `/api/events/create` - Create new event
- POST `/api/events/update` - Update existing event  
- POST `/api/events/delete` - Delete event
- POST `/api/profile` - Fetch user timezone

## Category Colors
Defined in `CATEGORY_COLORS` constant:
- Work: #3b82f6 (blue)
- School: #8b5cf6 (purple)
- Health & Hygiene: #ef4444 (red)
- Social: #f97316 (orange)
- Family: #ec4899 (pink)
- Personal: #10b981 (green)
- Fitness: #f59e0b (amber)
- Hobbies: #06b6d4 (cyan)
- Finance: #10b981 (green)
- Shopping: #78716c (stone)
- Travel: #6366f1 (indigo)
- Self-Care: #ec4899 (pink)

## Issues to Fix

### Priority 1: Missing Imports (Blocking Event Creation)
1. Add import for `ExtendedCalendarEvent` type
2. Add imports for `createEvent`, `deleteEvent` from calendarService
3. Define or import `getCategoryColor()` function
4. Add imports for Dialog components
5. Add imports for Button, Input components

### Priority 2: Week View Default (User Request)
Configure FullCalendar to always show today as second day in week view

### Priority 3: Error When Clicking Calendar Date
Likely caused by missing imports preventing EventModal from rendering properly
