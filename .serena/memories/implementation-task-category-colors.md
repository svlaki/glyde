# Task Category Colors Implementation

## Overview
Tasks display with color-coded categories across both TasksPage and CalendarPage. Categories are joined from the database and displayed with their assigned colors.

## Backend Implementation
- `SupabaseService.getTasks()` uses `get_tasks_with_categories` RPC function
- RPC joins `tasks` table with `categories` table on `category_id`
- Returns `category_name` and `category_color` for each task
- Agent auto-assigns categories when creating tasks via `create_task` tool

## Frontend Implementation

### Type Definitions (/apps/frontend/src/lib/taskService.ts)
```typescript
export interface Task {
  // ... other fields
  category?: string // DEPRECATED: use category_name
  category_id?: string
  category_name?: string // From categories table join
  category_color?: string // From categories table join
}
```

### Tasks Page Display (/apps/frontend/src/pages/TasksPage.tsx:180-196)
- Full task cards with colored category badges
- Category badge shows icon, name, and background color

### Calendar Page Display (/apps/frontend/src/pages/CalendarPage.tsx:354-393)
- Task cards with **colored left border** (4px thick)
- Border color matches category color
- Category name shown below title
```typescript
<div
  className="bg-white border-l-4 border-r border-t border-b border-gray-200 rounded-lg p-3"
  style={{ borderLeftColor: categoryColor }}
>
```

### Task Card Component (/apps/frontend/src/components/tasks/TaskCard.tsx:64-72)
- Displays category badge with color from `category.color`
- Uses inline style: `style={{ backgroundColor: category.color }}`
- Shows Tag icon and category name

## Migration Fix
Created `backfill_task_category_ids` migration to link existing tasks to categories:
```sql
UPDATE tasks t SET category_id = c.id
FROM categories c
WHERE t.category_id IS NULL AND c.user_id = t.user_id AND c.name = t.category;
```

## Agent Integration
- System prompt instructs agent to ALWAYS assign categories to tasks
- `create_task` tool requires category parameter
- Categories: Work, School, Health & Hygiene, Social, Fitness, Shopping, Finance, etc.

## Key Files
- Backend: `apps/agents/src/services/SupabaseService.ts` (getTasks, createTask)
- Frontend Interface: `apps/frontend/src/lib/taskService.ts`
- Tasks Page: `apps/frontend/src/pages/TasksPage.tsx`
- Calendar Page: `apps/frontend/src/pages/CalendarPage.tsx` (colored left border)
- Task Card: `apps/frontend/src/components/tasks/TaskCard.tsx`
- Agent Tools: `apps/agents/src/tools/tasks/create-task.ts`
- System Prompt: `apps/agents/src/agents/conversation/ConversationAgent.ts:355`