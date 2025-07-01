# Glydeeee Database Schema and Security Model

This document outlines the database schema design, security model, and data isolation approach used in the Glydeeee application.

## Schema Isolation Approach

Glydeeee implements a multi-tenant database architecture using Supabase's schema isolation pattern. Each user gets their own dedicated PostgreSQL schema, ensuring complete data isolation between users.

### Key Features:

- **Per-User Schemas**: Each user gets a dedicated schema named `u_<userId>` (with hyphens removed from UUID)
- **Automatic Schema Creation**: Schemas are created automatically when users sign up via:
  - Database trigger on `auth.users` table insertions
  - Edge Function for external authentication providers (Google OAuth)
- **Data Isolation**: Each user's data is completely isolated in their own schema
- **Security**: Row-Level Security (RLS) policies provide an additional layer of protection

## Table Structures and Relationships

### Public Tables

#### `public.profile`

Stores user profile information accessible across the application.

```sql
CREATE TABLE public.profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Per-User Tables

The following tables are created in each user's schema (`u_<userId>`):

#### `events`

Stores calendar events for the user.

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  description TEXT,
  recurrence JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `settings`

Stores user-specific settings and preferences.

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB
);
```

## Row-Level Security (RLS) Policies

### Public Profile Table

```sql
-- Enable RLS
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;

-- Users can view all profiles
CREATE POLICY "Users can view all profiles" 
  ON public.profile 
  FOR SELECT 
  USING (true);

-- Users can update only their own profile
CREATE POLICY "Users can update own profile" 
  ON public.profile 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Users cannot delete profiles
CREATE POLICY "Users cannot delete profiles" 
  ON public.profile 
  FOR DELETE 
  USING (false);
```

### Per-User Event Tables

Each user's `events` table has the following RLS policy:

```sql
-- Enable RLS
ALTER TABLE u_<userId>.events ENABLE ROW LEVEL SECURITY;

-- Only the owner can access their events
CREATE POLICY user_events 
  ON u_<userId>.events 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = '<userId>'::uuid);
```

## Security Considerations

### SECURITY DEFINER Functions

The application uses `SECURITY DEFINER` functions to perform operations that require elevated privileges:

1. **`create_user_schema()`**: Creates schemas and tables when users sign up
2. **`create_user_schema_rpc()`**: Called by Edge Function to create schemas for OAuth users
3. **`get_user_events()`**: Accesses user schemas to retrieve events
4. **`create_user_event()`**: Creates events in user schemas

These functions run with the privileges of the function creator (typically a database superuser) rather than the calling user, allowing them to create schemas and tables that would otherwise be inaccessible.

### Edge Function Security

The Edge Function `createUserSchema` implements several security measures:

- **Authentication Verification**: Validates that requests include a valid session
- **User Context**: Uses the authenticated user's context to determine schema name
- **Error Handling**: Implements comprehensive error handling and logging
- **RPC Calls**: Uses database RPC functions with proper parameters rather than direct SQL execution

## Admin Access

### Free/Busy View

A special view `public.vw_free_busy` is provided for admin users to see free/busy times across all users:

```sql
CREATE VIEW public.vw_free_busy AS
SELECT 
  e.id,
  e.starts_at,
  e.ends_at,
  p.display_name,
  p.email
FROM 
  -- Dynamic SQL in production to UNION ALL across schemas
  events e
JOIN 
  public.profile p ON e.user_id = p.id;
```

## Schema Creation Flow

1. User signs up or logs in
2. Authentication event triggers schema creation:
   - For direct signups: Database trigger calls `create_user_schema()`
   - For OAuth: Edge Function calls `create_user_schema_rpc()`
3. Schema and tables are created with appropriate RLS policies
4. User profile is created or updated in `public.profile` table

## Best Practices and Considerations

- **Schema Naming**: Consistent naming convention (`u_<userId>`) for easy identification
- **RLS Everywhere**: All tables have RLS enabled, even in isolated schemas
- **Defense in Depth**: Multiple security layers (schemas, RLS, function privileges)
- **Error Handling**: Comprehensive error handling in functions and Edge Functions
- **Logging**: Detailed logging for troubleshooting authentication and schema creation issues 