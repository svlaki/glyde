# Event, Goal, and Task Category System Review

## Current Architecture

### Data model and backend services
- The unified `categories` table stores user-specific categories with colors, icons, context metadata, and applicability flags, and enforces uniqueness per user while seeding a default palette via `create_default_categories`.【F:supabase/migrations/20250102000003_create_categories_system.sql†L1-L123】
- Category CRUD routes wrap `CategoryService`, which auto-populates defaults when none exist and validates inputs before persisting to Supabase.【F:apps/agents/src/api/categories.ts†L4-L188】【F:apps/agents/src/services/CategoryService.ts†L34-L357】
- Events, tasks, and goals all persist the category as a plain text field; SupabaseService writes and reads the string while falling back to hard-coded defaults when absent.【F:apps/agents/src/services/SupabaseService.ts†L66-L226】【F:apps/agents/src/services/SupabaseService.ts†L268-L371】

### Frontend consumption
- Tasks and goals fetch categories from the agent service, build a `name → Category` map, and use the stored color for badges in the list and detail cards while forms expose category selection by name.【F:apps/frontend/src/pages/TasksPage.tsx†L13-L199】【F:apps/frontend/src/pages/GoalsPage.tsx†L263-L408】
- The calendar also calls the event API but still relies on a static color map to translate category names to hex values, ignoring the dynamic categories returned by the backend.【F:apps/frontend/src/lib/calendarCategories.ts†L1-L22】【F:apps/frontend/src/pages/CalendarPage.tsx†L1-L181】
- The event modal offers the same static category list instead of the user’s actual categories, so newly created custom categories never appear in the dropdown or color chips even though the backend stores them.【F:apps/frontend/src/components/EventModal.tsx†L1-L199】

## Observed Gaps & Risks
- **String-based linkage.** Because events, tasks, and goals store the category name instead of a `category_id`, renaming or localizing a category risks breaking color lookups and historical data consistency. There is also no referential integrity preventing typos or stale category names.【F:apps/agents/src/services/SupabaseService.ts†L66-L371】
- **Inconsistent color sources.** Calendar experiences use hard-coded palettes, while the rest of the app respects user-managed colors, so the same category can appear with mismatched branding between views.【F:apps/frontend/src/lib/calendarCategories.ts†L1-L22】【F:apps/frontend/src/pages/TasksPage.tsx†L132-L191】
- **Custom categories ignored in calendar UI.** Users can create categories through the management page, but those categories are invisible when scheduling events, forcing them back to the default list.【F:apps/frontend/src/components/EventModal.tsx†L25-L199】【F:apps/agents/src/api/categories.ts†L16-L83】
- **Duplicate default seeding paths.** The backend seeds defaults both via SQL migrations and `CategoryService.createDefaultCategories`, while the frontend still carries its own palette definition, increasing divergence risk.【F:supabase/migrations/20250102000003_create_categories_system.sql†L57-L123】【F:apps/frontend/src/lib/calendarCategories.ts†L1-L22】

## Recommendations
1. **Persist category relationships by ID.** Store `category_id` (with a foreign key) on events, tasks, and goals, fetch joined category metadata in API responses, and expose the display name/color in the response payload. This prevents breakage when users rename categories and lets the database enforce consistency.【F:supabase/migrations/20250102000003_create_categories_system.sql†L4-L33】【F:apps/agents/src/services/SupabaseService.ts†L66-L371】
2. **Drive all UI colors from backend data.** Replace the static `CATEGORY_COLORS` map with the user’s fetched category records for calendar rendering and selection. Cache or memoize by ID to avoid extra requests but ensure a single source of truth for colors.【F:apps/frontend/src/lib/calendarCategories.ts†L1-L22】【F:apps/frontend/src/pages/CalendarPage.tsx†L34-L181】
3. **Unify category pickers.** Load categories once (e.g., via context or a shared hook) and feed them to task, goal, and event forms so custom categories are immediately selectable everywhere.【F:apps/frontend/src/pages/TasksPage.tsx†L13-L199】【F:apps/frontend/src/components/EventModal.tsx†L25-L199】
4. **Consolidate default seeding logic.** Keep defaults in one place (preferably the SQL function) and have the service check for existing rows without re-defining the list in TypeScript to prevent drift.【F:supabase/migrations/20250102000003_create_categories_system.sql†L57-L123】【F:apps/agents/src/services/CategoryService.ts†L296-L357】
5. **Expose category metadata to the calendar sidebar.** When showing upcoming tasks inside the calendar page, include the task’s category color chip (as already done on the dedicated Tasks page) for consistent visual cues.【F:apps/frontend/src/pages/CalendarPage.tsx†L90-L181】【F:apps/frontend/src/pages/TasksPage.tsx†L132-L191】
