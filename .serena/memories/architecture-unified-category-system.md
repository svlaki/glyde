# Unified Category System Architecture

## Implementation Date
2025-01-05

## Overview
Implemented a unified category system that replaces string-based category names with proper foreign key relationships using category IDs. This ensures data consistency, enables dynamic category management, and provides a single source of truth for category colors and metadata.

## Database Schema

### Categories Table
- Primary table: `public.categories`
- Columns: `id`, `user_id`, `name`, `color`, `icon`, `description`, `context`, `applies_to`, `display_order`
- Foreign key: `user_id` references `auth.users(id)`
- Unique constraint: `(user_id, name)`
- RLS enabled: Users can only access their own categories

### Entity Tables with Category Support
All entity tables now have `category_id` foreign key:
- `public.events` - has both `category` (deprecated) and `category_id`
- `public.tasks` - has both `category` (deprecated) and `category_id`
- `public.goals` - has both `category` (deprecated) and `category_id`

**Migration Strategy**: Keep old `category` column temporarily for backward compatibility, will be removed in future migration.

## Database Functions

### Helper Functions
1. **get_events_with_categories(p_user_id, p_start_date, p_end_date)**
   - Returns events joined with category data (name, color, icon)
   - Replaces direct table queries for better performance

2. **get_tasks_with_categories(p_user_id)**
   - Returns tasks with joined category metadata
   - Ordered by priority and due date

3. **get_goals_with_categories(p_user_id)**
   - Returns goals with joined category information
   - Ordered by priority score

4. **create_default_categories(target_user_id)**
   - Seeds default categories for new users
   - Single source of truth for default categories
   - Located in migration: `20250102000003_create_categories_system.sql`

## Backend Services

### SupabaseService Updates
- **getEvents()**: Now uses `get_events_with_categories()` RPC
- **getTasks()**: Now uses `get_tasks_with_categories()` RPC  
- **getGoals()**: Now uses `get_goals_with_categories()` RPC
- **createEvent()**: Accepts `category_id` or `category` name (looks up ID)
- **updateEvent()**: Accepts `category_id` or `category` name (looks up ID)

### CategoryService
- **createDefaultCategories()**: Calls database RPC instead of duplicating logic
- No more hardcoded category lists in TypeScript
- Single source of truth: SQL migration function

## Frontend Architecture

### CategoryContext
- **File**: `apps/frontend/src/lib/categoryContext.tsx`
- **Provider**: `CategoryProvider` wraps app in `main.tsx`
- **Hook**: `useCategories()` provides:
  - `categories`: Array of user's categories
  - `loading`: Loading state
  - `error`: Error message if any
  - `getCategoryById(id)`: Lookup category by ID
  - `getCategoryByName(name)`: Lookup category by name
  - `getCategoryColor(nameOrId)`: Get color for category
  - `refreshCategories()`: Reload categories from backend

### Component Updates

#### CalendarPage
- Removed static `CATEGORY_COLORS` map
- Uses `useCategories()` hook for dynamic colors
- EventModal dropdown populated from `categories` array
- Task sidebar shows category color chips using `getCategoryColor()`

#### Deprecated Files
- **apps/frontend/src/lib/calendarCategories.ts**: Marked as deprecated
- Will be removed in future update
- Use `useCategories()` hook instead

## Default Categories
Defined in SQL migration `20250102000003_create_categories_system.sql`:
1. Work 💼 #3b82f6
2. School 🎓 #8b5cf6
3. Health & Hygiene ❤️ #ef4444
4. Social 👥 #f97316
5. Family 👨‍👩‍👧‍👦 #ec4899
6. Personal 🏠 #10b981
7. Fitness 🏃 #f59e0b
8. Hobbies 🎨 #06b6d4
9. Finance 💰 #10b981
10. Shopping 🛒 #78716c
11. Travel ✈️ #6366f1
12. Self-Care 💆 #ec4899

## Benefits of This Architecture
1. **Referential Integrity**: Foreign keys prevent orphaned categories
2. **Data Consistency**: Renaming categories doesn't break historical data
3. **Dynamic UI**: Users can create custom categories that appear everywhere
4. **Single Source of Truth**: Default categories defined once in SQL
5. **Performance**: Joined queries reduce round trips
6. **Type Safety**: Category IDs are UUIDs, preventing typos

## Migration Path
1. ✅ Add category_id columns with foreign keys
2. ✅ Migrate existing category names to IDs
3. ✅ Create helper RPC functions
4. ✅ Update backend services to use new functions
5. ✅ Create CategoryContext for frontend
6. ✅ Update UI components to use dynamic categories
7. ✅ Consolidate default seeding logic
8. 🔄 Future: Remove deprecated `category` text columns

## Key Files
- Migration: `supabase/migrations/20250105000001_add_category_id_foreign_keys.sql`
- Backend Service: `apps/agents/src/services/SupabaseService.ts`
- Category Service: `apps/agents/src/services/CategoryService.ts`
- Frontend Context: `apps/frontend/src/lib/categoryContext.tsx`
- Main App: `apps/frontend/main.tsx` (CategoryProvider wrapper)
- Calendar: `apps/frontend/src/pages/CalendarPage.tsx`
- Tasks: `apps/frontend/src/pages/TasksPage.tsx`
- Goals: `apps/frontend/src/pages/GoalsPage.tsx`

## Testing Checklist
- [ ] Create new event with category
- [ ] Edit event category
- [ ] View events with correct colors
- [ ] Create custom category
- [ ] Custom category appears in event dropdown
- [ ] Tasks show category color chips
- [ ] Goals show category badges
- [ ] Category changes reflect immediately across all views
