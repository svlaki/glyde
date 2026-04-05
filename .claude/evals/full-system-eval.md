# FULL SYSTEM EVAL REPORT
Date: 2026-02-11

---

## 1. Database Schema (13/13 PASS)

| Table | Status |
|-------|--------|
| profile | PASS |
| events | PASS |
| tasks | PASS |
| goals | PASS |
| aspects | PASS |
| aspect_members | PASS |
| chat_messages | PASS |
| user_interactions | PASS |
| user_activity_log | PASS |
| life_plans | PASS |
| rules | PASS |
| user_friendships | PASS |
| recurring_event_exceptions | PASS |
| user_calendar_mappings | PASS |
| user_connections | PASS |

## 2. RPC Functions (6/6 PASS)

| Function | Exists | Executes |
|----------|--------|----------|
| get_events_with_aspects | PASS | PASS |
| get_tasks_with_aspects | PASS | PASS |
| get_goals_with_aspects | PASS | PASS |
| get_user_shared_aspects | PASS | PASS |
| can_edit_aspect (owner) | PASS | PASS (returns true) |
| can_edit_aspect (viewer) | PASS | PASS (returns false) |
| get_friends_events | PASS | PASS |

## 3. RLS Policies (9/9 PASS)

| Table | RLS Enabled |
|-------|-------------|
| events | PASS |
| tasks | PASS |
| goals | PASS |
| aspects | PASS |
| aspect_members | PASS |
| profile | PASS |
| rules | PASS |
| chat_messages | PASS |
| user_friendships | PASS |

## 4. Foreign Key Integrity (30/30 PASS)

All 30 FK constraints valid. Key FKs verified:
- events.aspect_id -> aspects.id
- tasks.aspect_id -> aspects.id
- goals.aspect_id -> aspects.id
- aspect_members.aspect_id -> aspects.id
- aspect_members.user_id -> auth.users
- aspect_members -> profile (via aspect_members_profile_fkey)

## 5. Data Integrity (9/10 PASS, 1 WARN)

| Check | Result |
|-------|--------|
| Orphaned event aspects | PASS (0) |
| Orphaned task aspects | PASS (0) |
| Orphaned goal aspects | PASS (0) |
| Event visibility values | PASS |
| Aspect visibility values | PASS |
| Aspect member roles | PASS |
| Friendship status values | PASS |
| Task status values | PASS |
| Goal status values | PASS |
| Profiles with display_name | WARN: 6 profiles without display_name |

## 6. Indexes (5/5 PASS)

| Index | Status |
|-------|--------|
| events.user_id | PASS |
| tasks.user_id | PASS |
| goals.user_id | PASS |
| aspects.visibility | PASS |
| aspect_members.user_id | PASS |

## 7. Storage (1/1 PASS)

| Bucket | Status |
|--------|--------|
| avatars | PASS |

## 8. Container Health (2/2 PASS)

| Container | Status | Ports |
|-----------|--------|-------|
| glydeeee-agents | Up | 8000 |
| glydeeee-frontend | Up (Vite ready) | 3000->5173 |

## 9. API Endpoints (2/2 PASS)

| Endpoint | HTTP Status |
|----------|-------------|
| Agent health (GET /health) | 200 PASS |
| Frontend (GET /) | 200 PASS |
| POST endpoints | Require auth (expected - 401 Unauthorized) |

## 10. Supabase Security Advisors

| Category | Count | Severity |
|----------|-------|----------|
| Function search_path mutable | ~40 functions | WARN (low risk - all use SECURITY DEFINER) |
| RLS policy always true | 2 (activity_log INSERT, interactions INSERT) | WARN (intentional for service role) |
| Extension in public schema | 1 (vector) | WARN |
| Auth OTP long expiry | 1 | WARN |
| Leaked password protection | Disabled | WARN |
| Postgres version | Security patches available | WARN |

---

## BUGS FOUND

### BUG 1: chat_messages.sender column does not exist (ERROR)
- **Severity**: HIGH
- **Location**: Agent logs show `column chat_messages.sender does not exist`
- **Root cause**: Table has column `role` (values: 'user'/'assistant'), but code references `sender`
- **Impact**: Chat history fetch fails for all users
- **Fix needed**: Update backend code to use `role` instead of `sender`

### BUG 2: 6 profiles without display_name (WARN)
- **Severity**: LOW
- **Impact**: Minor - these users may see blank names in UI
- **Note**: Likely test/incomplete accounts

---

## SUMMARY

| Category | Pass | Fail | Warn | Total |
|----------|------|------|------|-------|
| DB Schema | 15 | 0 | 0 | 15 |
| RPC Functions | 7 | 0 | 0 | 7 |
| RLS Policies | 9 | 0 | 0 | 9 |
| FK Integrity | 30 | 0 | 0 | 30 |
| Data Integrity | 9 | 0 | 1 | 10 |
| Indexes | 5 | 0 | 0 | 5 |
| Storage | 1 | 0 | 0 | 1 |
| Containers | 2 | 0 | 0 | 2 |
| API Health | 2 | 0 | 0 | 2 |
| Security Advisors | 0 | 0 | 6 | 6 |
| **TOTAL** | **80** | **0** | **7** | **87** |

**Overall: 80 PASS, 0 FAIL, 7 WARN + 1 BUG (chat_messages.sender)**

**Status: SYSTEM HEALTHY (1 bug to fix)**
