-- S2: metering. One row per AI attempt (docs/TOKEN_ECONOMY.md section 6).
-- Append-only. Never stores prompts, document text or answers.

create table public.ai_usage (
  id                  bigint generated always as identity primary key,
  user_id             uuid references auth.users (id) on delete set null,
  document_id         uuid references public.documents (id) on delete set null,
  request_id          text not null check (char_length(request_id) <= 64),
  profile             text not null check (profile in ('analysis', 'chat', 'chat_deep', 'fast', 'translate')),
  provider            text not null,
  model               text not null,
  input_tokens        int not null default 0 check (input_tokens >= 0),
  cache_read_tokens   int not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens  int not null default 0 check (cache_write_tokens >= 0),
  output_tokens       int not null default 0 check (output_tokens >= 0),
  cost_micros_usd     bigint not null default 0 check (cost_micros_usd >= 0),
  credits_charged     int not null default 0 check (credits_charged >= 0),
  latency_ms          int not null default 0 check (latency_ms >= 0),
  status              text not null check (status in ('ok', 'failed', 'aborted', 'cache_hit')),
  error_kind          text check (char_length(error_kind) <= 40),
  created_at          timestamptz not null default now()
);
create index ai_usage_created_at_idx on public.ai_usage (created_at);
create index ai_usage_user_id_created_at_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_request_id_idx on public.ai_usage (request_id);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
grant select, insert on public.ai_usage to service_role;

create policy "ai_usage: owner can select" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- The only write path for a signed-in request. user_id always comes from the session.
create function public.record_ai_usage(
  p_document_id uuid,
  p_request_id text,
  p_profile text,
  p_provider text,
  p_model text,
  p_input_tokens int,
  p_cache_read_tokens int,
  p_cache_write_tokens int,
  p_output_tokens int,
  p_cost_micros_usd bigint,
  p_latency_ms int,
  p_status text,
  p_error_kind text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.ai_usage (
    user_id, document_id, request_id, profile, provider, model, input_tokens, cache_read_tokens,
    cache_write_tokens, output_tokens, cost_micros_usd, latency_ms, status, error_kind
  ) values (
    v_uid,
    case when p_document_id is not null and public.owns_document(p_document_id) then p_document_id end,
    p_request_id, p_profile, p_provider, p_model, greatest(p_input_tokens, 0), greatest(p_cache_read_tokens, 0),
    greatest(p_cache_write_tokens, 0), greatest(p_output_tokens, 0), greatest(p_cost_micros_usd, 0),
    greatest(p_latency_ms, 0), p_status, p_error_kind
  );
end $$;
revoke all on function public.record_ai_usage(uuid, text, text, text, text, int, int, int, int, bigint, int, text, text) from public, anon;
grant execute on function public.record_ai_usage(uuid, text, text, text, text, int, int, int, int, bigint, int, text, text) to authenticated;

-- Global spend today in micro-USD (UTC day), for the budget guard. No per-user data leaves.
create function public.ai_spend_today() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(cost_micros_usd), 0)::bigint
  from public.ai_usage
  where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;
revoke all on function public.ai_spend_today() from public, anon;
grant execute on function public.ai_spend_today() to authenticated, service_role;
