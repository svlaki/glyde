#!/bin/bash
# Script to manually apply the recurrence migration to remote database

echo "Connecting to remote database and applying recurrence migration..."

# Get the Supabase project ref from the config
PROJECT_REF=$(grep 'project_id' supabase/.temp/project-ref 2>/dev/null || echo "")

# Apply the migration SQL directly
supabase db execute --file supabase/migrations/20251124000001_add_recurrence_to_events.sql --linked

echo "Migration applied successfully!"
