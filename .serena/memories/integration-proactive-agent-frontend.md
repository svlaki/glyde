# ProactiveAgent Frontend Integration - January 2025

## Status: ✅ FULLY COMPATIBLE

ProactiveAgent backend integration with frontend InteractionBox is verified and production-ready.

## Data Flow Architecture

### 1. Interaction Creation (Backend → Database)
**ProactiveAgent** → **SupabaseService.createUserInteraction()** → **user_interactions table**

Created fields:
```typescript
{
  user_id: string,
  agent_id: 'proactive',
  question: string,  // e.g., "Task X is due Friday. I found a 60-minute focus block..."
  interaction_type: 'yes_no',
  priority: number,  // 4-10 based on task urgency
  category_id: string | null,
  entity_id: string,  // task.id or goal.id
  metadata: {
    actionType: 'schedule_task_focus' | 'schedule_goal_activity',
    targetId: string,
    taskTitle?: string,
    goalTitle?: string,
    eventTitle: string,
    suggestedStartUtc: string,
    suggestedEndUtc: string,
    suggestedStartLocal: string,
    suggestedEndLocal: string,
    timezone: string,
    durationMinutes: number,
    displayTime: string,  // "Friday 2:00 PM"
    categoryId: string | null,
    categoryName?: string,
    dueDate?: string  // For tasks
  },
  expires_at: string,  // 6-8 hours from creation
  status: 'pending',
  created_at: string
}
```

### 2. Interaction Display (Database → Frontend)
**Supabase Realtime** → **InteractionService** → **useInteractions hook** → **InteractionBox component**

Frontend queries directly from Supabase (NOT via backend API):
```typescript
// apps/frontend/src/lib/interactions/interactionService.ts:81
async getPendingInteractions(): Promise<InteractionWithCategory[]> {
  const { data } = await supabase
    .from('user_interactions')
    .select(`
      *,
      category:categories(id, name, color)
    `)
    .eq('user_id', this.userId)
    .eq('status', 'pending')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('priority', { ascending: false })
}
```

**Transform to UI format**:
```typescript
// apps/frontend/src/hooks/useInteractions.ts:25
UIInteraction {
  id: string,
  question: string,
  type: 'yes_no' | 'multiple_choice' | 'confirmation',
  priority: number,
  category?: string,        // From joined categories table
  categoryColor?: string,   // From joined categories table
  entityId?: string,
  metadata?: Record<string, any>
}
```

### 3. User Response (Frontend → Backend)
**InteractionBox** → **useInteractions.respondToInteraction()** → **Backend API** → **ProactiveAgent**

```typescript
// Frontend calls backend API
fetch(`${AGENT_SERVICE_URL}/api/interactions/respond`, {
  method: 'POST',
  body: JSON.stringify({
    interaction_id: interactionId,
    response: 'yes' | 'no' | customText
  })
})

// Backend processes
// apps/agents/src/api/interactions.ts:67-112
respondToInteraction() {
  1. Save response to interaction_responses table
  2. Call ProactiveAgent.processMessage({
       command: 'handle_response',
       interactionId,
       response,
       interaction
     })
  3. ProactiveAgent creates calendar event
  4. ProactiveAgent persists to Zep memory
  5. Return success message
}
```

## Type Alignment Verification

### Backend Types (SupabaseService.createUserInteraction)
```typescript
interface CreateUserInteractionParams {
  agentId: AgentType | string;              ✓
  question: string;                         ✓
  interactionType: 'yes_no' | 'multiple_choice' | 'confirmation';  ✓
  options?: string[] | null;                ✓
  priority?: number;                        ✓
  categoryId?: string | null;               ✓
  entityId?: string | null;                 ✓
  metadata?: Record<string, any> | null;    ✓
  expiresAt?: string | null;                ✓
}
```

### Frontend Types (DBInteraction)
```typescript
interface DBInteraction {
  id: string;                               ✓
  user_id: string;                          ✓
  agent_id: string;                         ✓
  interaction_type: 'yes_no' | 'multiple_choice' | 'confirmation' | 'input';  ✓
  question: string;                         ✓
  options?: string[];                       ✓
  priority: number;                         ✓
  category_id?: string;                     ✓
  entity_id?: string;                       ✓
  metadata?: Record<string, any>;           ✓
  expires_at?: string;                      ✓
  created_at: string;                       ✓
  status: 'pending' | 'responded' | 'expired' | 'cancelled';  ✓
}
```

**Perfect Match** ✓ All fields align correctly.

## UI Metadata Usage

**InteractionBox.tsx** displays metadata fields:

```typescript
// Line 156-176
{interaction.metadata?.eventTitle && (
  <p className="text-xs truncate">
    {interaction.metadata.eventTitle}
  </p>
)}
{interaction.metadata?.displayTime && (
  <p className="text-[10px]">
    🕒 {interaction.metadata.displayTime}
  </p>
)}
{interaction.metadata?.dueDate && (
  <p className="text-[10px]">
    📆 Due {new Date(interaction.metadata.dueDate).toLocaleDateString()}
  </p>
)}
```

**ProactiveAgent populates these fields**:
- ✓ `eventTitle`: Set in metadata (line 228, 325)
- ✓ `displayTime`: Set in metadata (line 235, 332)
- ✓ `dueDate`: Set in metadata for tasks (line 227)

## Real-time Updates

**Supabase Realtime Subscription**:
```typescript
// apps/frontend/src/lib/interactions/interactionService.ts:46-78
setupRealtimeSubscription() {
  supabase.channel(`interactions:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_interactions',
      filter: `user_id=eq.${userId}`
    }, (payload) => {
      window.dispatchEvent(new CustomEvent('interaction-update', {
        detail: { type: payload.eventType, interaction: payload.new }
      }))
    })
}
```

**Frontend auto-updates** when:
- New interaction created (INSERT) → Added to UI
- Interaction status changes (UPDATE) → Removed if no longer pending
- Interaction deleted (DELETE) → Removed from UI

## API Endpoints

### `/api/interactions/pending` (POST)
**Purpose**: Manually trigger ProactiveAgent to generate new interactions

**Request**:
```typescript
{
  manual?: boolean  // Default false
}
```

**Response**:
```typescript
{
  success: true,
  interactions: DBInteraction[],  // All pending interactions
  summary: string,                // "Created N proactive interactions..."
  metadata: InteractionCreationResult[]
}
```

### `/api/interactions/respond` (POST)
**Purpose**: Process user response and execute agent action

**Request**:
```typescript
{
  interaction_id: string,
  response: string  // 'yes', 'no', or custom text
}
```

**Response**:
```typescript
{
  success: true,
  message: string,     // "Scheduled 'Focus: Write Report' for Friday at 2:00 PM"
  metadata: {
    action: 'event_created',
    interactionId: string,
    eventId: string,
    start: string,
    end: string
  }
}
```

### `/api/interactions/clear` (POST)
**Purpose**: Cancel all pending interactions for user

**Response**:
```typescript
{
  success: true,
  message: string,
  cleared_count: number
}
```

### `/api/agents/proactive/run` (POST)
**Purpose**: Manually trigger proactive agent (force generation)

**Response**:
```typescript
{
  success: true,
  message: string,
  interactionsCreated: number,
  metadata: InteractionCreationResult[]
}
```

## Integration Testing Checklist

### Backend Tests ✓
1. ProactiveAgent creates interactions with correct fields
2. Metadata includes all UI-required fields (eventTitle, displayTime, dueDate)
3. Category IDs properly set for color coding
4. Priority correctly derived from task urgency
5. Expiration time set (6-8 hours)

### Frontend Tests ✓
1. InteractionService queries Supabase correctly
2. UIInteraction transform handles all metadata fields
3. InteractionBox displays question, time, due date
4. Category colors applied correctly
5. Yes/No buttons call respondToInteraction
6. Real-time subscription updates UI

### End-to-End Flow ✓
1. User has pending task due soon
2. ProactiveAgent generates interaction → Stored in DB
3. Real-time subscription fires → Frontend updates
4. InteractionBox displays card with task info
5. User clicks "Yes"
6. Backend creates calendar event
7. Backend persists to Zep memory
8. Interaction removed from UI
9. Calendar shows new event

## No Issues Found

✅ Type alignment perfect
✅ Metadata fields match UI expectations
✅ API contracts correct
✅ Real-time updates working
✅ Build successful (no TypeScript errors)

## Example User Journey

1. **Morning**: User has task "Prepare presentation" due Friday
2. **ProactiveAgent runs**: Finds free slot Thursday 2-3pm
3. **Interaction created**: 
   ```
   Question: "Prepare presentation" is due Friday, Jan 12. I found a 60-minute 
             focus block tomorrow at 2:00 PM. Should I schedule it?
   Metadata: {
     eventTitle: "Focus: Prepare presentation",
     displayTime: "Thursday 2:00 PM",
     dueDate: "2025-01-12"
   }
   ```
4. **User sees card**: Purple card (work category) with question + details
5. **User clicks Yes**: Event created, task marked in_progress
6. **Calendar updates**: "Focus: Prepare presentation" appears Thursday 2pm
7. **Zep memory**: Natural language event stored for future context

## Conclusion

ProactiveAgent is **fully integrated** with frontend InteractionBox:
- ✅ All type definitions aligned
- ✅ Metadata fields properly populated
- ✅ API contracts match expectations
- ✅ Real-time updates functional
- ✅ No compatibility issues found
- ✅ Production ready