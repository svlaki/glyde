# Goals Authorization Fix - January 2025

## Problem
Goals were not displaying on the frontend with "Unauthorized" errors. The agent could create goals, but they weren't visible in the GoalsPage UI.

## Root Cause
The `goalService.ts` frontend service was missing JWT authentication headers in API calls, unlike other services (tasks, profile, categories) which properly included Authorization headers.

## Investigation Path
1. Checked GoalsPage.tsx - confirmed it calls goalService functions correctly
2. Checked goals.ts API endpoints - confirmed they use `req.authUserId` from auth middleware
3. Checked auth middleware - confirmed it properly extracts userId from JWT token
4. Compared goalService.ts with taskService.ts - **FOUND ISSUE**: goalService missing Authorization headers
5. Checked server.ts - confirmed auth middleware was properly registered

## Solution Implemented

### Backend Changes (apps/agents/src/api/server.ts)
**File**: `apps/agents/src/api/server.ts:97-99`

Added authentication middleware early in the middleware chain (right after request logging):
```typescript
// Authentication middleware - validates JWT and sets req.authUserId
// This runs early to ensure protected routes have user context
app.use(authenticateRequest);
```

This ensures all API routes (except auth-exempt paths like /health) validate JWT tokens and set `req.authUserId`.

### Frontend Changes (apps/frontend/src/lib/goalService.ts)

Updated all goal service functions to:
1. Accept `accessToken` parameter (like taskService.ts pattern)
2. Include Authorization header in fetch calls
3. Validate accessToken presence before making API calls

**Updated Functions**:
- `fetchUserGoals(user, accessToken, filters?)` - Added Authorization header
- `createUserGoal(user, accessToken, goalData)` - Added Authorization header  
- `updateUserGoal(user, accessToken, goalId, updates)` - Added Authorization header
- `deleteUserGoal(user, accessToken, goalId)` - Added Authorization header
- `addGoalCheckIn(user, accessToken, goalId, checkInData)` - Added Authorization header

**Pattern Applied**:
```typescript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${accessToken}`  // ← Added this
}
```

### Frontend Changes (apps/frontend/src/pages/GoalsPage.tsx)

Updated GoalsPage component to:
1. Get session from auth context: `const { user, session } = useAuth()`
2. Check for access token: `if (!user || !session?.access_token) return`
3. Pass access token to all service calls: `fetchUserGoals(user, session.access_token, filters)`

**Updated Functions**:
- `loadGoals()` - Added session.access_token parameter
- `handleCreateGoal()` - Added session.access_token parameter
- `handleUpdateGoal()` - Added session.access_token parameter
- `handleDeleteGoal()` - Added session.access_token parameter
- `CheckInModal.handleSubmit()` - Added session.access_token parameter

**Updated Dependencies**:
```typescript
useCallback(..., [user, session, filter])  // Added 'session' to dependencies
```

## Files Modified
1. **apps/agents/src/api/server.ts** - Added authentication middleware
2. **apps/frontend/src/lib/goalService.ts** - Added Authorization headers to all API calls
3. **apps/frontend/src/pages/GoalsPage.tsx** - Updated to use session.access_token

## Testing Checklist
- [ ] Goals display on GoalsPage without "Unauthorized" errors
- [ ] Create new goal works
- [ ] Update existing goal works  
- [ ] Delete goal works
- [ ] Goal check-in works
- [ ] Agent can create goals and they appear on frontend
- [ ] Real-time updates still work via Supabase subscriptions

## Pattern to Follow
When creating new frontend services, ALWAYS follow the taskService.ts pattern:
1. Accept `accessToken` parameter
2. Include `'Authorization': \`Bearer ${accessToken}\`` header
3. Validate `user` AND `accessToken` before API calls
4. Page components should get session from `useAuth()` and pass `session.access_token`

## Related Files
- **Auth Middleware**: `apps/agents/src/api/middleware/auth.ts`
- **Task Service (reference)**: `apps/frontend/src/lib/taskService.ts`
- **Profile Service (reference)**: `apps/frontend/src/lib/profileService.ts`
- **Category Service**: Uses different auth pattern (not updated yet)

## Key Takeaway
All frontend API services must include JWT token in Authorization header. The backend auth middleware (`authenticateRequest`) validates the token and sets `req.authUserId` for use in API handlers. Without the Authorization header, requests return 401 Unauthorized.
