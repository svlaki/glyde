-- Add LangChain-compatible match functions for vector similarity search
-- Based on official Supabase LangChain documentation pattern

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create match_events function for LangChain SupabaseVectorStore
create or replace function match_events (
  query_embedding vector(1536),
  match_count int DEFAULT null,
  filter jsonb DEFAULT '{}'
) returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)

language plpgsql
as $$
#variable_conflict use_column
declare
  user_schema text;
begin
  -- Extract user schema from filter if provided
  user_schema := filter->>'user_schema';
  
  if user_schema is not null then
    -- Search in user-specific schema (user schema uses different column names)
    return query execute format('
      select
        e.id,
        concat(e.title, '' '', coalesce(e.description, ''''), '' '', coalesce(e.location, '''')) as content,
        jsonb_build_object(
          ''id'', e.id,
          ''event_title'', e.title,
          ''event_starts_at'', e.start_time,
          ''event_ends_at'', e.end_time,
          ''event_location'', e.location,
          ''event_description'', e.description,
          ''event_created_at'', e.created_at,
          ''event_updated_at'', e.updated_at
        ) as metadata,
        1 - (e.embedding <=> $1) as similarity
      from %I.events e
      where e.embedding is not null
      order by e.embedding <=> $1
      limit $2
    ', user_schema)
    using query_embedding, match_count;
  else
    -- Fallback to public schema (public schema column names)
    return query
    select
      e.id,
      concat(e.title, ' ', coalesce(e.description, ''), ' ', coalesce(e.location, '')) as content,
      jsonb_build_object(
        'id', e.id,
        'event_title', e.title,
        'event_starts_at', e.start_time,
        'event_ends_at', e.end_time,
        'event_location', e.location,
        'event_description', e.description,
        'event_created_at', e.created_at,
        'event_updated_at', e.updated_at
      ) as metadata,
      1 - (e.embedding <=> query_embedding) as similarity
    from public.events e
    where e.embedding is not null
    order by e.embedding <=> query_embedding
    limit match_count;
  end if;
end;
$$;

-- Create match_chat_messages function for LangChain SupabaseVectorStore
create or replace function match_chat_messages (
  query_embedding vector(1536),
  match_count int DEFAULT null,
  filter jsonb DEFAULT '{}'
) returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
declare
  user_schema text;
begin
  -- Extract user schema from filter if provided
  user_schema := filter->>'user_schema';
  
  if user_schema is not null then
    -- Search in user-specific schema
    return query execute format('
      select
        m.id,
        m.content,
        jsonb_build_object(
          ''id'', m.id,
          ''content'', m.content,
          ''sender'', m.sender,
          ''session_id'', m.session_id,
          ''user_id'', m.user_id,
          ''timestamp'', m.timestamp
        ) as metadata,
        1 - (m.embedding <=> $1) as similarity
      from %I.chat_messages m
      where m.embedding is not null
      order by m.embedding <=> $1
      limit $2
    ', user_schema)
    using query_embedding, match_count;
  else
    -- Fallback to public schema (shouldn't happen normally)
    return query
    select
      m.id,
      m.content,
      jsonb_build_object(
        'id', m.id,
        'content', m.content,
        'sender', m.sender,
        'session_id', m.session_id,
        'user_id', m.user_id,
        'timestamp', m.timestamp
      ) as metadata,
      1 - (chat_messages.embedding <=> query_embedding) as similarity
    from public.chat_messages m
    where m.embedding is not null
    order by m.embedding <=> query_embedding
    limit match_count;
  end if;
end;
$$;