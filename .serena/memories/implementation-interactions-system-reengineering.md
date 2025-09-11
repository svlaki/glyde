# Smart Interactions System Re-engineering

## Overview
Completely rebuilt the interactions system from scratch to fix timezone bugs, eliminate duplicates, and integrate with Zep memory for intelligent suggestions.

## New Architecture

### Database Layer
- **user_interactions table**: Stores generated interactions with expiration
- **interaction_responses table**: Tracks user responses for learning
- **Database functions**: `get_user_active_interactions()`, `respond_to_interaction()`
- **RLS policies**: Secure user data access
- **Unique constraints**: Prevent duplicate active interactions

### Backend Components

#### InteractionAgent (apps/agents/src/agents/interaction/InteractionAgent.ts)
- Extends BaseAgent with Zep memory integration
- Generates contextual interactions based on user patterns
- Uses SupabaseService.createEvent() for consistent timezone handling
- Stores interaction outcomes in Zep for learning
- Max 1 interaction generated at a time to avoid overwhelming users

#### API Endpoints (apps/agents/src/api/interactions.ts)
- `/api/interactions/generate` - Generate new interactions
- `/api/interactions/active` - Get active interactions (replaces polling)
- `/api/interactions/respond` - Handle user responses and create events
- `/api/interactions/dismiss` - Dismiss interactions
- Uses database persistence instead of in-memory storage

### Frontend Components

#### SmartInteractions (apps/frontend/src/components/SmartInteractions.tsx)
- Real-time Supabase subscriptions for instant updates
- Chat-style UI with proper button styling
- Automatic calendar refresh when events are created
- No client-side deduplication (handled by database)
- Max 2 interactions displayed at once

## Key Improvements

### Timezone Handling
- Uses user's profile timezone consistently via SupabaseService.getProfile()
- Leverages existing convertToUTC() from timezoneUtils
- Same event creation flow as ConversationAgent (proven to work)

### Deduplication
- Database unique constraint prevents duplicate active interactions
- No more client-side duplicate tracking needed

### Memory Integration
- Zep stores user interaction patterns and preferences
- InteractionAgent learns from past responses
- Contextual suggestions based on user behavior

### Real-time Updates
- Supabase real-time subscriptions replace polling
- Instant UI updates when interactions change
- Automatic cleanup of expired interactions

## Removed Files
- SmartInteractionService.ts (replaced by InteractionAgent)
- CalendarIntelligenceService.ts (logic moved to InteractionAgent)
- InteractionBox.tsx (replaced by SmartInteractions)
- InteractionProvider context (replaced by database subscriptions)
- agentInteractionHook.ts (no longer needed)

## Database Schema
```sql
-- Key tables and functions created in migration
CREATE TABLE user_interactions (
  id, user_id, question, type, options, event_data,
  priority, category, context, created_at, expires_at, status
);

CREATE TABLE interaction_responses (
  id, interaction_id, user_id, response, created_at
);

-- Unique constraint prevents duplicates
CREATE UNIQUE INDEX idx_unique_active_interaction 
ON user_interactions(user_id, question, type) 
WHERE status = 'active';
```

## Integration Points
- Uses existing SupabaseService for event creation
- Leverages ZepMemoryService for user context
- Integrates with ConversationAgent's proven timezone handling
- Real-time updates via Supabase subscriptions
- Compatible with existing calendar refresh mechanisms

This implementation provides a solid foundation for intelligent, personalized calendar suggestions with proper timezone handling and no duplicate issues.