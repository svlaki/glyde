# Frontend Real-time Category Updates Fix

## Problem
When the ConversationAgent updated event/task categories via the backend tools, the changes were saved to the database but not reflected in the frontend immediately. Users had to manually refresh the page to see category changes.

## Root Causes

### 1. Missing Task Real-time Subscription
**File**: `apps/frontend/src/pages/CalendarPage.tsx` (lines 194-213)

The CalendarPage had a Supabase real-time subscription for the `events` table, but **NOT** for the `tasks` table. This meant:
- Event changes triggered automatic UI refresh ✅
- Task changes did NOT trigger automatic UI refresh ❌

### 2. Browser Caching
**Files**: 
- `apps/frontend/src/lib/calendarService.ts` (fetchUserEvents)
- `apps/frontend/src/lib/taskService.ts` (fetchUserTasks)

The fetch requests had no cache-control headers, allowing browsers to cache API responses and serve stale data.

## Solution

### 1. Added Task Real-time Subscription
**File**: `apps/frontend/src/pages/CalendarPage.tsx` (lines 194-233)

```typescript
// Subscribe to events table changes
const eventsChannel = supabase
  .channel(`events-${user.id}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'events',
    filter: `user_id=eq.${user.id}`
  }, () => {
    console.log('🔄 [CalendarPage] Events changed, reloading...');
    loadUserEvents();
  })
  .subscribe();

// Subscribe to tasks table changes (for category updates)
const tasksChannel = supabase
  .channel(`tasks-${user.id}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks',
    filter: `user_id=eq.${user.id}`
  }, () => {
    console.log('🔄 [CalendarPage] Tasks changed, reloading...');
    loadUserTasks();
  })
  .subscribe();

return () => {
  eventsChannel.unsubscribe();
  tasksChannel.unsubscribe();
};
```

### 2. Added Cache-Control Headers
**File**: `apps/frontend/src/lib/calendarService.ts` (lines 46-60)

```typescript
const headers: HeadersInit = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache'
};

const response = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify(body),
  cache: 'no-store'
});
```

**File**: `apps/frontend/src/lib/taskService.ts` (lines 47-60)

```typescript
const response = await fetch(`${API_URL}/api/tasks`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache'
  },
  body: JSON.stringify({
    user_id: user.id,
    ...filters
  }),
  cache: 'no-store'
});
```

## Impact
- ✅ Event category updates now trigger immediate frontend refresh
- ✅ Task category updates now trigger immediate frontend refresh
- ✅ No browser caching of stale event/task data
- ✅ Real-time UI updates for all database changes

## Testing
After agent updates categories:
1. Check browser console for "🔄 [CalendarPage] Events/Tasks changed, reloading..." logs
2. Verify events/tasks UI updates immediately without page refresh
3. Verify category colors update in real-time

## Related Files
- `apps/frontend/src/pages/CalendarPage.tsx` - Real-time subscriptions
- `apps/frontend/src/lib/calendarService.ts` - Event fetching with cache headers
- `apps/frontend/src/lib/taskService.ts` - Task fetching with cache headers
- `apps/agents/src/tools/calendar/update-event.ts` - Category parameter fix
- `apps/agents/src/agents/conversation/ConversationAgent.ts` - Bulk update instructions