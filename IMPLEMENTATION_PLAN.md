# Glydeeee - Comprehensive Implementation Plan

## Current State Audit (2025-01-02)

### ✅ What's Working
- [x] Per-user database schemas (`u_{user_id}`)
- [x] Events table with archetype system
- [x] User authentication and RLS policies
- [x] Zep Cloud memory service integration (conversations)
- [x] LangChain/LangGraph agent infrastructure
- [x] ConversationAgent with calendar tools
- [x] Streaming chat interface
- [x] Frontend calendar view with FullCalendar
- [x] Event archetype forms and display
- [x] Smart interaction system (basic gap finding)

### ⚠️ Schema Exists But Not Connected
- [x] Tasks table schema (created by migrations)
- [x] Goals table schema (created by migrations)
- [x] Goal check-ins table schema (created by migrations)
- [x] User profile with JSONB context fields (created by migrations)
- [ ] **NOT CONNECTED**: No agent tools to use these tables
- [ ] **NOT CONNECTED**: No frontend UI to display/edit
- [ ] **NOT CONNECTED**: No Supabase service methods

### ❌ Critical Issues to Fix

#### 1. **BLOCKER: Missing Zep Cloud Package**
```bash
apps/agents/node_modules/@getzep/zep-cloud → NOT INSTALLED
```
- **Impact**: TypeScript compilation fails completely
- **Files Broken**: ZepGraphService.ts, ZepMemoryService.ts
- **Priority**: P0 - Must fix immediately

#### 2. **Missing: AI Context Profile Schema**
- Profile table has generic JSONB fields but no structured schema
- No `ai_context_profile` column added yet
- No TypeScript interface defined
- No agent tools to read/update profile

#### 3. **Missing: Task Management System**
- Tasks table exists but:
  - No SupabaseService methods (createTask, updateTask, etc.)
  - No agent tools (only placeholder create-task.ts exists)
  - No frontend components
  - No API endpoints

#### 4. **Missing: Goal Management System**
- Goals table exists but:
  - No SupabaseService methods
  - No agent tools
  - No frontend components
  - No API endpoints
  - No check-in workflow

#### 5. **Missing: Profile Management UI**
- No frontend page to view/edit user profile
- No components to display AI context profile
- No way for users to manually input preferences
- No visualization of what the AI knows about them

#### 6. **Missing: Database Table for Entity Mappings**
- EntityMappingService uses in-memory cache only
- No persistent storage for Zep graph UUID mappings
- Need `entity_graph_mappings` table in Supabase

---

## Implementation Plan

### 🔴 **PHASE 0: Critical Fixes (Day 1)**
**Goal**: Get the build working and fix blockers

#### Task 0.1: Install Missing Dependencies
```bash
cd apps/agents
npm install @getzep/zep-cloud
npm run build  # Verify compilation works
```

#### Task 0.2: Verify Database Migrations
```bash
# Check all migrations have been applied
# Verify tasks/goals tables exist for existing users
```

#### Task 0.3: Create Entity Mapping Table
**File**: `supabase/migrations/20250102000001_create_entity_mappings.sql`
```sql
CREATE TABLE public.entity_graph_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- 'CalendarEvent', 'Task', 'Goal'
  entity_id UUID NOT NULL,    -- Supabase entity ID
  graph_uuid UUID NOT NULL,   -- Zep graph entity UUID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_entity_mappings_user_id ON public.entity_graph_mappings(user_id);
CREATE INDEX idx_entity_mappings_entity ON public.entity_graph_mappings(entity_type, entity_id);
CREATE INDEX idx_entity_mappings_graph_uuid ON public.entity_graph_mappings(graph_uuid);

-- Enable RLS
ALTER TABLE public.entity_graph_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own entity mappings"
ON public.entity_graph_mappings
FOR ALL USING (auth.uid() = user_id);
```

#### Task 0.4: Update EntityMappingService
**File**: `apps/agents/src/services/EntityMappingService.ts`
- Replace in-memory cache with database queries
- Use Supabase to store/retrieve mappings

---

### 🟠 **PHASE 1: AI Context Profile Infrastructure (Days 2-3)**
**Goal**: Add structured profile system for AI learning

#### Task 1.1: Add Profile Column Migration
**File**: `supabase/migrations/20250102000002_add_ai_context_profile.sql`
```sql
-- Add ai_context_profile column to profile table
ALTER TABLE public.profile
ADD COLUMN IF NOT EXISTS ai_context_profile JSONB DEFAULT '{
  "version": "1.0",
  "lastUpdated": null,
  "life": {},
  "work": {},
  "productivity": {},
  "health": {},
  "relationships": {},
  "routines": {},
  "decisionMaking": {},
  "communication": {},
  "learning": {},
  "agentPreferences": {
    "proactivityLevel": "medium",
    "suggestionFrequency": "moderate",
    "notificationStyle": "batched",
    "tonePreference": "friendly",
    "explanationLevel": "concise",
    "confirmationRequired": ["calendar-changes", "task-creation"]
  },
  "rules": {}
}'::jsonb;

-- Create GIN index for efficient querying
CREATE INDEX IF NOT EXISTS idx_profile_ai_context_gin
ON public.profile USING GIN (ai_context_profile);

-- Add comment
COMMENT ON COLUMN public.profile.ai_context_profile IS
'Structured AI learning profile - continuously updated by agent and user edits';
```

#### Task 1.2: Create TypeScript Interface
**File**: `apps/agents/src/types/profile.ts`
```typescript
// Create complete AIContextProfile interface
// (Use structure from PRODUCT_VISION.md)
```

#### Task 1.3: Create Profile Service
**File**: `apps/agents/src/services/ProfileService.ts`
```typescript
export class ProfileService {
  async getProfile(userId: string): Promise<AIContextProfile>
  async updateProfile(userId: string, updates: Partial<AIContextProfile>): Promise<void>
  async updateProfileSection(userId: string, section: string, data: any): Promise<void>
  async getProfileSection(userId: string, section: string): Promise<any>
}
```

#### Task 1.4: Create Profile Agent Tools
**Files**:
- `apps/agents/src/tools/profile/get-profile.ts`
- `apps/agents/src/tools/profile/update-profile.ts`
- `apps/agents/src/tools/profile/query-profile.ts`

#### Task 1.5: Update ConversationAgent to Use Profile
- Modify `loadMemoryContext()` to include profile data
- Add profile-based decision making to tool selection
- Implement passive profile learning from conversations

---

### 🟡 **PHASE 2: Task Management System (Days 4-5)**
**Goal**: Full task CRUD with agent and UI integration

#### Task 2.1: Add SupabaseService Task Methods
**File**: `apps/agents/src/services/SupabaseService.ts`
```typescript
// Add methods:
async createTask(userId: string, task: TaskCreateInput): Promise<Task>
async updateTask(userId: string, taskId: string, updates: TaskUpdateInput): Promise<Task>
async deleteTask(userId: string, taskId: string): Promise<void>
async getTasks(userId: string, filters?: TaskFilters): Promise<Task[]>
async getTask(userId: string, taskId: string): Promise<Task | null>
async completeTask(userId: string, taskId: string, notes?: string): Promise<Task>
```

#### Task 2.2: Create Task Agent Tools
**Files**:
- `apps/agents/src/tools/tasks/create-task.ts` (replace placeholder)
- `apps/agents/src/tools/tasks/update-task.ts`
- `apps/agents/src/tools/tasks/delete-task.ts`
- `apps/agents/src/tools/tasks/list-tasks.ts`
- `apps/agents/src/tools/tasks/complete-task.ts`
- `apps/agents/src/tools/tasks/search-tasks.ts`

#### Task 2.3: Register Task Tools in ConversationAgent
**File**: `apps/agents/src/agents/conversation/ConversationAgent.ts`
```typescript
// Import and register all task tools
this.tools.push(
  createTaskTool,
  updateTaskTool,
  deleteTaskTool,
  listTasksTool,
  completeTaskTool,
  searchTasksTool
);
```

#### Task 2.4: Create Task API Endpoints
**File**: `apps/agents/src/api/tasks.ts`
```typescript
export async function getUserTasks(req, res)
export async function createUserTask(req, res)
export async function updateUserTask(req, res)
export async function deleteUserTask(req, res)
export async function completeUserTask(req, res)
```

**File**: `apps/agents/src/api/server.ts`
```typescript
// Add routes:
app.post('/api/tasks', getUserTasks);
app.post('/api/tasks/create', createUserTask);
app.post('/api/tasks/update', updateUserTask);
app.post('/api/tasks/delete', deleteUserTask);
app.post('/api/tasks/complete', completeUserTask);
```

#### Task 2.5: Create Frontend Task Components
**Files**:
- `apps/frontend/src/components/tasks/TaskList.tsx`
- `apps/frontend/src/components/tasks/TaskItem.tsx`
- `apps/frontend/src/components/tasks/TaskModal.tsx`
- `apps/frontend/src/pages/TasksPage.tsx`

#### Task 2.6: Add Task Service to Frontend
**File**: `apps/frontend/src/lib/taskService.ts`
```typescript
export async function getTasks()
export async function createTask(task)
export async function updateTask(taskId, updates)
export async function deleteTask(taskId)
export async function completeTask(taskId, notes)
```

---

### 🟢 **PHASE 3: Goal Management System (Days 6-7)**
**Goal**: Full goal tracking with check-ins and progress

#### Task 3.1: Add SupabaseService Goal Methods
**File**: `apps/agents/src/services/SupabaseService.ts`
```typescript
// Add methods:
async createGoal(userId: string, goal: GoalCreateInput): Promise<Goal>
async updateGoal(userId: string, goalId: string, updates: GoalUpdateInput): Promise<Goal>
async deleteGoal(userId: string, goalId: string): Promise<void>
async getGoals(userId: string, filters?: GoalFilters): Promise<Goal[]>
async getGoal(userId: string, goalId: string): Promise<Goal | null>
async addGoalCheckIn(userId: string, goalId: string, checkIn: GoalCheckInInput): Promise<GoalCheckIn>
async getGoalCheckIns(userId: string, goalId: string): Promise<GoalCheckIn[]>
async updateGoalProgress(userId: string, goalId: string, progress: number): Promise<Goal>
```

#### Task 3.2: Create Goal Agent Tools
**Files**:
- `apps/agents/src/tools/goals/create-goal.ts`
- `apps/agents/src/tools/goals/update-goal.ts`
- `apps/agents/src/tools/goals/delete-goal.ts`
- `apps/agents/src/tools/goals/list-goals.ts`
- `apps/agents/src/tools/goals/check-in-goal.ts`
- `apps/agents/src/tools/goals/update-progress.ts`

#### Task 3.3: Register Goal Tools in ConversationAgent

#### Task 3.4: Create Goal API Endpoints
**File**: `apps/agents/src/api/goals.ts`

#### Task 3.5: Create Frontend Goal Components
**Files**:
- `apps/frontend/src/components/goals/GoalList.tsx`
- `apps/frontend/src/components/goals/GoalCard.tsx`
- `apps/frontend/src/components/goals/GoalModal.tsx`
- `apps/frontend/src/components/goals/GoalCheckInModal.tsx`
- `apps/frontend/src/components/goals/GoalProgressChart.tsx`
- `apps/frontend/src/pages/GoalsPage.tsx`

---

### 🔵 **PHASE 4: Profile Management UI (Days 8-9)**
**Goal**: User can view and edit their AI context profile

#### Task 4.1: Create Profile API Endpoints
**File**: `apps/agents/src/api/profile.ts`
```typescript
export async function getUserProfile(req, res)
export async function updateUserProfile(req, res)
export async function getProfileSection(req, res)
export async function updateProfileSection(req, res)
```

#### Task 4.2: Create Frontend Profile Components

**File**: `apps/frontend/src/pages/ProfilePage.tsx`
```tsx
// Main profile page with tabs for each section
<ProfilePage>
  <Tabs>
    <Tab name="Overview" />
    <Tab name="Life Context" />
    <Tab name="Work" />
    <Tab name="Productivity" />
    <Tab name="Health & Wellness" />
    <Tab name="Relationships" />
    <Tab name="Routines" />
    <Tab name="Preferences" />
    <Tab name="Agent Settings" />
  </Tabs>
</ProfilePage>
```

**File**: `apps/frontend/src/components/profile/ProfileOverview.tsx`
```tsx
// Shows high-level summary of all profile sections
// Visual indicators for completeness
// Agent insights about the user
```

**File**: `apps/frontend/src/components/profile/LifeContextSection.tsx`
```tsx
// Editable form for:
// - Core values (tag input)
// - Life phase (dropdown)
// - Major commitments (list)
// - Goals (short/medium/long term)
//
// Shows AI-discovered data with "Edit" button
// Shows user-entered data as editable
// Visual distinction between AI-learned vs user-provided
```

**File**: `apps/frontend/src/components/profile/WorkContextSection.tsx`
**File**: `apps/frontend/src/components/profile/ProductivitySection.tsx`
**File**: `apps/frontend/src/components/profile/HealthSection.tsx`
**File**: `apps/frontend/src/components/profile/RelationshipsSection.tsx`
**File**: `apps/frontend/src/components/profile/RoutinesSection.tsx`
**File**: `apps/frontend/src/components/profile/PreferencesSection.tsx`
**File**: `apps/frontend/src/components/profile/AgentSettingsSection.tsx`

#### Task 4.3: Create Profile Editing UI Pattern

**Design Pattern: Collaborative Editing**
```tsx
<ProfileField>
  <Label>
    Peak Focus Hours
    {isAILearned && <Badge>AI Learned</Badge>}
    {isUserEdited && <Badge>User Verified</Badge>}
  </Label>

  <Value>
    {isEditing ? (
      <HourPicker value={peakHours} onChange={handleChange} />
    ) : (
      <Display>{peakHours.join(", ")}</Display>
    )}
  </Value>

  <Actions>
    {!isEditing && <Button onClick={startEdit}>Edit</Button>}
    {isEditing && (
      <>
        <Button onClick={save}>Save</Button>
        <Button onClick={cancel}>Cancel</Button>
      </>
    )}
  </Actions>

  {aiInsight && (
    <AINote>
      <Icon>🤖</Icon>
      {aiInsight}
    </AINote>
  )}
</ProfileField>
```

**Visual Design**:
- **AI-learned fields**: Subtle blue highlight, robot icon
- **User-edited fields**: Green checkmark
- **Empty fields**: Dashed border, "Click to add"
- **Conflicting data**: Yellow warning, "AI thinks X but you said Y"

#### Task 4.4: Add Profile Service to Frontend
**File**: `apps/frontend/src/lib/profileService.ts`

---

### 🟣 **PHASE 5: Enhanced Interactions (Days 10-11)**
**Goal**: Profile-aware proactive suggestions

#### Task 5.1: Refactor SmartInteractionService
**File**: `apps/agents/src/services/SmartInteractionService.ts`
```typescript
// Update to use ProfileService
// Implement interaction strategy matrix from PRODUCT_VISION.md
// Add profile-based prioritization
// Generate interactions based on profile fields
```

#### Task 5.2: Create Interaction Templates
**File**: `apps/agents/src/services/InteractionTemplates.ts`
```typescript
// Template functions for each interaction type:
export function gapFillingTemplate(gap, profile): Interaction
export function routineMissingTemplate(routine, profile): Interaction
export function energyMismatchTemplate(task, profile): Interaction
export function boundaryViolationTemplate(event, profile): Interaction
export function goalNeglectTemplate(goal, profile): Interaction
// etc...
```

#### Task 5.3: Update Frontend Interaction Display
**File**: `apps/frontend/src/components/InteractionBox.tsx`
- Show profile context that triggered the interaction
- Display why the agent made this suggestion
- Allow user to correct agent's understanding

---

### 🟤 **PHASE 6: Task-Goal-Event Linking (Days 12-13)**
**Goal**: Connect the three systems intelligently

#### Task 6.1: Add Cross-Reference Queries
**File**: `apps/agents/src/services/SupabaseService.ts`
```typescript
// Get all tasks for a goal
async getTasksForGoal(userId: string, goalId: string): Promise<Task[]>

// Get goal for a task
async getGoalForTask(userId: string, taskId: string): Promise<Goal | null>

// Get events related to a task
async getEventsForTask(userId: string, taskId: string): Promise<Event[]>

// Create task from event
async createTaskFromEvent(userId: string, eventId: string): Promise<Task>

// Create event from task (schedule it)
async createEventFromTask(userId: string, taskId: string, startTime: Date): Promise<Event>
```

#### Task 6.2: Add Linking Tools
**Files**:
- `apps/agents/src/tools/linking/link-task-to-goal.ts`
- `apps/agents/src/tools/linking/create-task-from-event.ts`
- `apps/agents/src/tools/linking/schedule-task.ts`
- `apps/agents/src/tools/linking/get-goal-tasks.ts`

#### Task 6.3: Update Frontend to Show Links
- Task detail shows parent goal
- Goal detail shows child tasks
- Event detail shows linked task
- Visual indicators for linked entities

---

### ⚫ **PHASE 7: Zep Graph Integration (Days 14-15)**
**Goal**: Full Zep knowledge graph for all entities

#### Task 7.1: Update ZepGraphService
**File**: `apps/agents/src/services/ZepGraphService.ts`
```typescript
// Use EntityMappingService (now with database backing)
// Enable real Zep Graph API calls (currently placeholders)
// Add task entity methods:
async addTask(userId: string, task: TaskEntity): Promise<string>
async updateTask(userId: string, taskId: string, updates: Partial<TaskEntity>): Promise<void>
async deleteTask(userId: string, taskId: string): Promise<void>

// Add goal entity methods:
async addGoal(userId: string, goal: GoalEntity): Promise<string>
async updateGoal(userId: string, goalId: string, updates: Partial<GoalEntity>): Promise<void>
async deleteGoal(userId: string, goalId: string): Promise<void>
```

#### Task 7.2: Update Tool Implementations
- Modify calendar tools to persist to graph (already partially done)
- Add task tools to persist to graph
- Add goal tools to persist to graph
- Make all graph operations fire-and-forget (non-blocking)

---

### 🎨 **PHASE 8: UI Polish & Integration (Days 16-17)**
**Goal**: Cohesive user experience

#### Task 8.1: Create Unified Dashboard
**File**: `apps/frontend/src/pages/DashboardPage.tsx`
```tsx
<Dashboard>
  <Section name="Today's Overview">
    <UpcomingEvents />
    <PendingTasks />
    <GoalProgress />
  </Section>

  <Section name="AI Insights">
    <RecentLearnings />
    <ProfileCompleteness />
    <SuggestedActions />
  </Section>

  <Section name="Quick Actions">
    <AddEventButton />
    <AddTaskButton />
    <CheckInGoalButton />
  </Section>
</Dashboard>
```

#### Task 8.2: Add Navigation
**File**: `apps/frontend/src/components/Navigation.tsx`
```tsx
<Nav>
  <NavItem to="/dashboard">Dashboard</NavItem>
  <NavItem to="/calendar">Calendar</NavItem>
  <NavItem to="/tasks">Tasks</NavItem>
  <NavItem to="/goals">Goals</NavItem>
  <NavItem to="/profile">Profile</NavItem>
  <NavItem to="/chat">AI Assistant</NavItem>
</Nav>
```

#### Task 8.3: Mobile Responsiveness
- Ensure all components work on mobile
- Add responsive layouts
- Touch-friendly interaction areas

---

## Testing Checklist

### Backend Tests
- [ ] Profile CRUD operations
- [ ] Task CRUD operations
- [ ] Goal CRUD operations
- [ ] Profile learning from conversations
- [ ] Entity mapping persistence
- [ ] Zep graph synchronization
- [ ] Cross-reference queries (task-goal-event links)

### Frontend Tests
- [ ] Profile page loads and displays data
- [ ] Profile editing saves correctly
- [ ] Task list shows user tasks
- [ ] Task creation works
- [ ] Goal tracking workflow
- [ ] Calendar integration with tasks/goals
- [ ] AI insights display correctly

### Integration Tests
- [ ] Agent creates task via chat
- [ ] Agent creates goal via chat
- [ ] Agent updates profile from conversation
- [ ] User edits profile, agent sees changes
- [ ] Task linked to goal shows in UI
- [ ] Event created from task
- [ ] Proactive interactions generated based on profile

---

## Database Migration Order

```bash
# Run these in order:
1. 20250102000001_create_entity_mappings.sql
2. 20250102000002_add_ai_context_profile.sql
3. (Verify all previous migrations have run)
```

---

## File Creation Checklist

### Database Migrations (2 files)
- [ ] `20250102000001_create_entity_mappings.sql`
- [ ] `20250102000002_add_ai_context_profile.sql`

### Backend Services (3 files)
- [ ] `apps/agents/src/services/ProfileService.ts`
- [ ] Update `apps/agents/src/services/EntityMappingService.ts`
- [ ] Update `apps/agents/src/services/ZepGraphService.ts`

### Backend Types (1 file)
- [ ] `apps/agents/src/types/profile.ts` (AIContextProfile interface)

### Backend Tools - Profile (3 files)
- [ ] `apps/agents/src/tools/profile/get-profile.ts`
- [ ] `apps/agents/src/tools/profile/update-profile.ts`
- [ ] `apps/agents/src/tools/profile/query-profile.ts`

### Backend Tools - Tasks (6 files)
- [ ] `apps/agents/src/tools/tasks/create-task.ts` (replace)
- [ ] `apps/agents/src/tools/tasks/update-task.ts`
- [ ] `apps/agents/src/tools/tasks/delete-task.ts`
- [ ] `apps/agents/src/tools/tasks/list-tasks.ts`
- [ ] `apps/agents/src/tools/tasks/complete-task.ts`
- [ ] `apps/agents/src/tools/tasks/search-tasks.ts`

### Backend Tools - Goals (6 files)
- [ ] `apps/agents/src/tools/goals/create-goal.ts`
- [ ] `apps/agents/src/tools/goals/update-goal.ts`
- [ ] `apps/agents/src/tools/goals/delete-goal.ts`
- [ ] `apps/agents/src/tools/goals/list-goals.ts`
- [ ] `apps/agents/src/tools/goals/check-in-goal.ts`
- [ ] `apps/agents/src/tools/goals/update-progress.ts`

### Backend Tools - Linking (4 files)
- [ ] `apps/agents/src/tools/linking/link-task-to-goal.ts`
- [ ] `apps/agents/src/tools/linking/create-task-from-event.ts`
- [ ] `apps/agents/src/tools/linking/schedule-task.ts`
- [ ] `apps/agents/src/tools/linking/get-goal-tasks.ts`

### Backend API (3 files)
- [ ] `apps/agents/src/api/tasks.ts`
- [ ] `apps/agents/src/api/goals.ts`
- [ ] `apps/agents/src/api/profile.ts`

### Frontend Services (3 files)
- [ ] `apps/frontend/src/lib/taskService.ts`
- [ ] `apps/frontend/src/lib/goalService.ts`
- [ ] `apps/frontend/src/lib/profileService.ts`

### Frontend Pages (4 files)
- [ ] `apps/frontend/src/pages/DashboardPage.tsx`
- [ ] `apps/frontend/src/pages/TasksPage.tsx`
- [ ] `apps/frontend/src/pages/GoalsPage.tsx`
- [ ] `apps/frontend/src/pages/ProfilePage.tsx`

### Frontend Components - Tasks (3 files)
- [ ] `apps/frontend/src/components/tasks/TaskList.tsx`
- [ ] `apps/frontend/src/components/tasks/TaskItem.tsx`
- [ ] `apps/frontend/src/components/tasks/TaskModal.tsx`

### Frontend Components - Goals (5 files)
- [ ] `apps/frontend/src/components/goals/GoalList.tsx`
- [ ] `apps/frontend/src/components/goals/GoalCard.tsx`
- [ ] `apps/frontend/src/components/goals/GoalModal.tsx`
- [ ] `apps/frontend/src/components/goals/GoalCheckInModal.tsx`
- [ ] `apps/frontend/src/components/goals/GoalProgressChart.tsx`

### Frontend Components - Profile (10 files)
- [ ] `apps/frontend/src/components/profile/ProfileOverview.tsx`
- [ ] `apps/frontend/src/components/profile/LifeContextSection.tsx`
- [ ] `apps/frontend/src/components/profile/WorkContextSection.tsx`
- [ ] `apps/frontend/src/components/profile/ProductivitySection.tsx`
- [ ] `apps/frontend/src/components/profile/HealthSection.tsx`
- [ ] `apps/frontend/src/components/profile/RelationshipsSection.tsx`
- [ ] `apps/frontend/src/components/profile/RoutinesSection.tsx`
- [ ] `apps/frontend/src/components/profile/PreferencesSection.tsx`
- [ ] `apps/frontend/src/components/profile/AgentSettingsSection.tsx`
- [ ] `apps/frontend/src/components/profile/ProfileField.tsx` (reusable)

### Frontend Components - Navigation (1 file)
- [ ] `apps/frontend/src/components/Navigation.tsx`

---

## Execution Timeline

**Total Estimated Time**: 17 days (3.5 weeks)

| Phase | Days | Focus |
|-------|------|-------|
| Phase 0 | 1 | Fix critical build issues |
| Phase 1 | 2 | AI context profile infrastructure |
| Phase 2 | 2 | Task management system |
| Phase 3 | 2 | Goal management system |
| Phase 4 | 2 | Profile UI |
| Phase 5 | 2 | Enhanced interactions |
| Phase 6 | 2 | Task-goal-event linking |
| Phase 7 | 2 | Zep graph integration |
| Phase 8 | 2 | UI polish |

**Parallelization Opportunities**:
- Phase 2 & 3 can be done simultaneously (tasks & goals are independent)
- Phase 4 can start while Phase 5 is in progress
- Frontend work can happen in parallel with backend once APIs are defined

---

## Success Criteria

### Phase 0 Complete When:
- [x] `npm run build` succeeds without errors
- [x] All TypeScript compiles
- [x] Entity mappings persist to database

### Phase 1 Complete When:
- [x] Profile has `ai_context_profile` JSONB column
- [x] Agent can read and update profile
- [x] Profile updates from conversation

### Phase 2 Complete When:
- [x] User can create tasks via chat
- [x] User can see tasks in UI
- [x] User can edit/complete/delete tasks
- [x] Tasks persist to database and Zep graph

### Phase 3 Complete When:
- [x] User can create goals via chat
- [x] User can see goals in UI
- [x] User can check in on goals
- [x] Goals track progress over time

### Phase 4 Complete When:
- [x] User can view their full profile
- [x] User can edit any profile section
- [x] Changes sync to agent
- [x] Visual distinction between AI-learned and user-entered data

### Phase 5 Complete When:
- [x] Interactions reference profile context
- [x] Suggestions align with user preferences
- [x] Interaction quality improves with profile completeness

### Phase 6 Complete When:
- [x] Tasks can be linked to goals
- [x] Events can become tasks
- [x] Tasks can be scheduled as events
- [x] UI shows all relationships

### Phase 7 Complete When:
- [x] All entities persist to Zep graph
- [x] Graph queries return relevant context
- [x] Entity mappings stored in database

### Phase 8 Complete When:
- [x] Dashboard provides unified view
- [x] Navigation is intuitive
- [x] Mobile experience is polished
- [x] All features are accessible

---

## Ready to Execute?

**Start with Phase 0, Task 0.1**:
```bash
cd apps/agents
npm install @getzep/zep-cloud
npm run build
```

If build succeeds, proceed to Task 0.2. If not, investigate and fix any remaining issues.

**Questions before starting?**
- Do we need to adjust priorities?
- Should any phases be done in a different order?
- Are there additional features to include?
