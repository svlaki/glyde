-- This script iterates through all user schemas ('u_%') and adds an 'embedding' column
-- to the 'events' table, but only if that table actually exists in the schema.

DO $$
DECLARE
    schema_name TEXT;
BEGIN
    -- Loop through all schemas that match the user schema pattern 'u_%'
    FOR schema_name IN
        SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname LIKE 'u_%'
    LOOP
        -- The to_regclass function returns NULL if the table does not exist.
        -- This is a safe way to check for table existence before acting on it.
        IF to_regclass(schema_name || '.events') IS NOT NULL THEN
            -- The table exists, so we can proceed to alter it.
            -- 'ADD COLUMN IF NOT EXISTS' provides an extra layer of safety.
            EXECUTE format(
                'ALTER TABLE %I.events ADD COLUMN IF NOT EXISTS embedding vector(1536)',
                schema_name
            );
            RAISE NOTICE 'Success: Checked/Altered table "events" in schema "%".', schema_name;
        ELSE
            -- The table does not exist in this schema, so we skip it.
            RAISE NOTICE 'Info: Skipped schema "%" because it does not contain an "events" table.', schema_name;
        END IF;
    END LOOP;
END $$;
