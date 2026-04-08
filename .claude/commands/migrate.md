Create a new Supabase migration for: $ARGUMENTS

1. Look at `supabase/migrations/` to determine the next timestamp (format: YYYYMMDDHHMMSS)
2. Create the migration file in `supabase/migrations/`
3. Write idempotent SQL (use IF NOT EXISTS, DROP before CREATE for functions)
4. Include RLS policies with `user_id = auth.uid()` for any new tables
5. Run `npx supabase db push` to apply
6. If types changed, use the Supabase MCP to regenerate TypeScript types
