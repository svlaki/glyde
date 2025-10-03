# Immediate Next Steps - Priority Order

## ✅ COMPLETED (Just Now)
1. Installed `@getzep/zep-cloud` package
2. TypeScript build now succeeds
3. Created database migrations:
   - `20250102000001_create_entity_mappings.sql` - Persistent Zep UUID storage
   - `20250102000002_add_ai_context_profile.sql` - AI learning profile
   - `20250102000003_create_categories_system.sql` - Unified categories for events/tasks/goals
4. Created TypeScript interfaces:
   - `apps/agents/src/types/profile.ts` - Complete AI Context Profile types
5. Created services:
   - `apps/agents/src/services/ProfileService.ts` - Profile management
   - `apps/agents/src/services/CategoryService.ts` - Category management

## 🔥 DO THESE NOW (Critical Path)

### Step 1: Apply Database Migrations
```bash
# Navigate to Supabase project and apply migrations
cd supabase
npx supabase db push

# Or if using hosted Supabase, run migrations via dashboard
# Upload the 3 new migration files
```

### Step 2: Update EntityMappingService (10 minutes)
**File**: `apps/agents/src/services/EntityMappingService.ts`

Replace in-memory cache with database calls:
```typescript
// BEFORE: this.mappingCache.set(key, mapping)
// AFTER: await supabase.from('entity_graph_mappings').insert(...)

// BEFORE: this.mappingCache.get(key)
// AFTER: await supabase.from('entity_graph_mappings').select(...).single()
```

### Step 3: Update User Creation to Include Categories (5 minutes)
**File**: `apps/agents/src/api/user.ts`

Add after schema creation:
```typescript
import categoryService from '../services/CategoryService.js';

// After create_user_schema_rpc succeeds:
await categoryService.createDefaultCategories(userId);
```

### Step 4: Add SupabaseService Methods for Tasks (30 minutes)
**File**: `apps/agents/src/services/SupabaseService.ts`

Add these methods:
```typescript
async createTask(userId: string, task: TaskInput): Promise<Task>
async updateTask(userId: string, taskId: string, updates: any): Promise<Task>
async deleteTask(userId: string, taskId: string): Promise<void>
async getTasks(userId: string, filters?: any): Promise<Task[]>
async completeTask(userId: string, taskId: string, notes?: string): Promise<Task>
```

### Step 5: Add SupabaseService Methods for Goals (30 minutes)
**File**: `apps/agents/src/services/SupabaseService.ts`

Add these methods:
```typescript
async createGoal(userId: string, goal: GoalInput): Promise<Goal>
async updateGoal(userId: string, goalId: string, updates: any): Promise<Goal>
async deleteGoal(userId: string, goalId: string): Promise<void>
async getGoals(userId: string, filters?: any): Promise<Goal[]>
async addGoalCheckIn(userId: string, goalId: string, checkIn: any): Promise<any>
```

### Step 6: Create Basic Task Tools (1 hour)
**Files**: Create in `apps/agents/src/tools/tasks/`
- `create-task.ts` (update existing placeholder)
- `update-task.ts`
- `delete-task.ts`
- `list-tasks.ts`
- `complete-task.ts`

Template:
```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const createTaskTool = tool(
  async ({ title, description, dueDate, priority, category }, { configurable }) => {
    const userId = configurable?.userId;
    if (!userId) return "❌ User ID required";

    const supabaseService = getSupabaseService();
    const task = await supabaseService.createTask(userId, {
      title,
      description,
      due_date: dueDate,
      priority,
      category,
    });

    if (!task) return "❌ Failed to create task";
    return `✅ Task created: "${title}" (Due: ${dueDate || 'No deadline'})`;
  },
  {
    name: "create_task",
    description: "Create a new task with optional deadline",
    schema: z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      dueDate: z.string().optional().describe("Due date (ISO format)"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Priority"),
      category: z.string().optional().describe("Category name"),
    }),
  }
);
```

### Step 7: Create Basic Goal Tools (1 hour)
**Files**: Create in `apps/agents/src/tools/goals/`
- `create-goal.ts`
- `update-goal.ts`
- `list-goals.ts`
- `check-in-goal.ts`

### Step 8: Register Tools in ConversationAgent (15 minutes)
**File**: `apps/agents/src/agents/conversation/ConversationAgent.ts`

Import and add to tools array:
```typescript
import { createTaskTool, updateTaskTool, listTasksTool, completeTaskTool, deleteTaskTool } from '../../tools/tasks/index.js';
import { createGoalTool, updateGoalTool, listGoalsTool, checkInGoalTool } from '../../tools/goals/index.js';

// In constructor or registerTools():
this.tools.push(
  createTaskTool,
  updateTaskTool,
  listTasksTool,
  completeTaskTool,
  deleteTaskTool,
  createGoalTool,
  updateGoalTool,
  listGoalsTool,
  checkInGoalTool
);
```

### Step 9: Create Task/Goal API Endpoints (1 hour)
**File**: `apps/agents/src/api/tasks.ts`
**File**: `apps/agents/src/api/goals.ts`

Copy pattern from `apps/agents/src/api/events.ts`

Add to `apps/agents/src/api/server.ts`:
```typescript
import { getUserTasks, createUserTask, updateUserTask, deleteUserTask } from './tasks.js';
import { getUserGoals, createUserGoal, updateUserGoal, deleteUserGoal } from './goals.js';

app.post('/api/tasks', getUserTasks);
app.post('/api/tasks/create', createUserTask);
app.post('/api/tasks/update', updateUserTask);
app.post('/api/tasks/delete', deleteUserTask);

app.post('/api/goals', getUserGoals);
app.post('/api/goals/create', createUserGoal);
app.post('/api/goals/update', updateUserGoal);
app.post('/api/goals/delete', deleteUserGoal);
```

### Step 10: Create Frontend TasksPage (2 hours)
**File**: `apps/frontend/src/pages/TasksPage.tsx`

Basic task list with:
- Display pending tasks
- Create task button → modal
- Mark complete checkbox
- Edit/delete actions
- Category badges with colors

### Step 11: Create Frontend GoalsPage (2 hours)
**File**: `apps/frontend/src/pages/GoalsPage.tsx`

Basic goal tracking with:
- Goal cards showing progress bars
- Create goal button → modal
- Check-in button
- Edit/delete actions
- Category badges

### Step 12: Create Frontend ProfilePage (3 hours)
**File**: `apps/frontend/src/pages/ProfilePage.tsx`

Tabbed interface:
- Overview tab (profile summary, completeness %)
- Life Context tab (editable fields)
- Work tab (editable fields)
- Productivity tab (editable fields)
- Health tab (editable fields)
- Agent Preferences tab (settings)

Pattern for each field:
```tsx
<div className="profile-field">
  <label>{fieldName}</label>
  {aiLearned && <Badge>🤖 AI Learned</Badge>}
  {isEditing ? (
    <input value={value} onChange={handleChange} />
  ) : (
    <span>{value || "Not set"}</span>
  )}
  <button onClick={toggleEdit}>{isEditing ? "Save" : "Edit"}</button>
</div>
```

### Step 13: Create Frontend CategoriesPage (2 hours)
**File**: `apps/frontend/src/pages/CategoriesPage.tsx`

Manage categories:
- List all categories with colors/icons
- Create new category button → modal
- Edit category (name, color, icon, context)
- Delete category (with warning if in use)
- Apply to (events/tasks/goals checkboxes)

### Step 14: Update Navigation (30 minutes)
**File**: `apps/frontend/src/App.tsx` or routing file

Add routes:
```tsx
<Route path="/tasks" element={<TasksPage />} />
<Route path="/goals" element={<GoalsPage />} />
<Route path="/profile" element={<ProfilePage />} />
<Route path="/categories" element={<CategoriesPage />} />
```

Create navigation component with links.

### Step 15: Test End-to-End (1 hour)
1. Create a task via chat: "Create a task to review the code by Friday"
2. Verify task appears in TasksPage
3. Create a goal via chat: "I want to learn system design this quarter"
4. Verify goal appears in GoalsPage
5. Edit profile in ProfilePage
6. Verify agent uses profile context in suggestions
7. Create/edit categories
8. Verify colors appear on tasks/goals/events

## 📊 Time Estimate

**Critical path (Steps 1-9)**: ~5-6 hours
**Frontend (Steps 10-14)**: ~9-10 hours
**Total minimum viable implementation**: **14-16 hours**

## 🎯 Success Criteria

After completing these steps:
- ✅ Users can create tasks via chat and UI
- ✅ Users can create goals via chat and UI
- ✅ Users can view/edit their AI profile
- ✅ Users can manage categories
- ✅ Categories apply consistent colors across events/tasks/goals
- ✅ Agent uses profile context for better suggestions
- ✅ All data persists correctly

## 🚀 After MVP is Working

Then proceed with:
- Profile learning from conversations (agent auto-updates)
- Enhanced interaction templates using profile
- Task-goal linking
- Event-task conversion
- Zep graph full integration
- Dashboard with unified view
- Mobile responsive design
- Goal check-in workflow
- Recurring tasks
- Goal progress charts

## 📁 File Structure After Implementation

```
apps/agents/src/
├── services/
│   ├── SupabaseService.ts (add task/goal methods)
│   ├── EntityMappingService.ts (update to use DB)
│   ├── ProfileService.ts ✅ CREATED
│   └── CategoryService.ts ✅ CREATED
├── types/
│   ├── profile.ts ✅ CREATED
│   ├── database.ts (add Task, Goal interfaces)
│   └── categories.ts (add Category interfaces)
├── tools/
│   ├── tasks/
│   │   ├── create-task.ts
│   │   ├── update-task.ts
│   │   ├── list-tasks.ts
│   │   ├── complete-task.ts
│   │   └── delete-task.ts
│   ├── goals/
│   │   ├── create-goal.ts
│   │   ├── update-goal.ts
│   │   ├── list-goals.ts
│   │   └── check-in-goal.ts
│   └── profile/
│       ├── get-profile.ts
│       └── update-profile.ts
└── api/
    ├── tasks.ts
    ├── goals.ts
    └── user.ts (update with categories)

apps/frontend/src/
├── pages/
│   ├── TasksPage.tsx
│   ├── GoalsPage.tsx
│   ├── ProfilePage.tsx
│   └── CategoriesPage.tsx
├── components/
│   ├── tasks/
│   │   ├── TaskList.tsx
│   │   └── TaskModal.tsx
│   ├── goals/
│   │   ├── GoalList.tsx
│   │   └── GoalModal.tsx
│   ├── profile/
│   │   └── ProfileField.tsx
│   └── categories/
│       ├── CategoryList.tsx
│       └── CategoryModal.tsx
└── lib/
    ├── taskService.ts
    ├── goalService.ts
    ├── profileService.ts
    └── categoryService.ts

supabase/migrations/
├── 20250102000001_create_entity_mappings.sql ✅ CREATED
├── 20250102000002_add_ai_context_profile.sql ✅ CREATED
└── 20250102000003_create_categories_system.sql ✅ CREATED
```

---

**Ready to continue? Start with Step 1 (apply migrations) then proceed through steps 2-15 in order.**

Each step builds on the previous one. The first 9 steps get the backend working, then steps 10-14 build the UI.
