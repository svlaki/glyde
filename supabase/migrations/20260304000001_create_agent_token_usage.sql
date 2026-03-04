-- Track token usage from agent interactions for cost/context analysis
create table if not exists public.agent_token_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text,
  model_name text not null default 'gpt-5.1',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  model_calls integer not null default 1,
  tools_used text[] default '{}',
  processing_time_ms integer,
  created_at timestamptz not null default now(),
  constraint check_token_counts check (input_tokens >= 0 and output_tokens >= 0 and total_tokens >= 0),
  constraint check_processing_time check (processing_time_ms is null or processing_time_ms > 0)
);

-- Indexes for common query patterns
create index if not exists idx_agent_token_usage_user_created
  on public.agent_token_usage (user_id, created_at desc);

create index if not exists idx_agent_token_usage_created
  on public.agent_token_usage (created_at desc);

create index if not exists idx_agent_token_usage_model_created
  on public.agent_token_usage (model_name, created_at desc);

-- Enable RLS (service role bypasses for admin queries)
alter table public.agent_token_usage enable row level security;

-- Users can read their own token usage
create policy "Users can view own token usage"
  on public.agent_token_usage for select
  using (auth.uid() = user_id);

-- Service role can insert (used by backend agents)
create policy "Service role can insert token usage"
  on public.agent_token_usage for insert
  with check (true);
