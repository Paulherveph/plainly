-- S2: text-first pipeline, analysis cache, page search, jobs, chat dedup, feature flags.

-- ───────── documents: new columns, plan-level caps ─────────
alter table public.documents
  add column content_hash text check (char_length(content_hash) = 64),
  add column vision_pages int[] not null default '{}',
  add column sample_id text check (sample_id in ('lease', 'visa', 'offer')),
  add column chat_summary text check (char_length(chat_summary) <= 4000);
alter table public.documents drop constraint documents_page_count_check;
alter table public.documents add constraint documents_page_count_check check (page_count between 1 and 100);
create index documents_user_id_content_hash_idx on public.documents (user_id, content_hash);

update storage.buckets set file_size_limit = 31457280 where id = 'documents';

-- ───────── document_pages: page text with a full-text index (no embeddings) ─────────
create table public.document_pages (
  document_id  uuid not null references public.documents (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page         int not null check (page between 1 and 100),
  text         text not null,
  needs_vision boolean not null default false,
  tsv          tsvector generated always as (to_tsvector('simple', text)) stored,
  primary key (document_id, page)
);
create index document_pages_tsv_idx on public.document_pages using gin (tsv);
create index document_pages_user_id_idx on public.document_pages (user_id);

alter table public.document_pages enable row level security;
revoke all on public.document_pages from anon, authenticated;
grant select, insert, update, delete on public.document_pages to authenticated;
grant all on public.document_pages to service_role;
create policy "document_pages: owner can select" on public.document_pages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "document_pages: owner can insert" on public.document_pages
  for insert to authenticated with check (user_id = (select auth.uid()) and public.owns_document(document_id));
create policy "document_pages: owner can update" on public.document_pages
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_document(document_id));
create policy "document_pages: owner can delete" on public.document_pages
  for delete to authenticated using (user_id = (select auth.uid()));

-- Top pages of one document for a question. Runs as the caller, so RLS applies.
create function public.search_document_pages(p_document_id uuid, p_query text, p_limit int default 5)
returns table (page int, text text)
language sql stable set search_path = '' as $$
  -- Any word of the question may match (OR), with prefix matching; ranked by ts_rank.
  with q as (
    select to_tsquery('simple', nullif(array_to_string(
             array(select quote_literal(lexeme) || ':*' from unnest(to_tsvector('simple', left(p_query, 1000)))),
             ' | '), '')) as anyq
  )
  select p.page, p.text
  from public.document_pages p, q
  where p.document_id = p_document_id
    and (q.anyq is not null and p.tsv @@ q.anyq)
  order by ts_rank(p.tsv, q.anyq) desc, p.page
  limit least(greatest(p_limit, 1), 10);
$$;
revoke all on function public.search_document_pages(uuid, text, int) from public, anon;
grant execute on function public.search_document_pages(uuid, text, int) to authenticated;

-- ───────── analysis_cache: same text + locale + versions = same result, 0 credits ─────────
create table public.analysis_cache (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cache_key   text not null check (char_length(cache_key) <= 200),
  result      jsonb not null,
  model       text not null,
  dropped     int not null default 0,
  created_at  timestamptz not null default now(),
  primary key (user_id, cache_key)
);
alter table public.analysis_cache enable row level security;
revoke all on public.analysis_cache from anon, authenticated;
grant select, insert, update, delete on public.analysis_cache to authenticated;
grant all on public.analysis_cache to service_role;
create policy "analysis_cache: owner can select" on public.analysis_cache
  for select to authenticated using (user_id = (select auth.uid()));
create policy "analysis_cache: owner can insert" on public.analysis_cache
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "analysis_cache: owner can update" on public.analysis_cache
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "analysis_cache: owner can delete" on public.analysis_cache
  for delete to authenticated using (user_id = (select auth.uid()));

-- ───────── jobs: long work with an id, status and idempotency key ─────────
create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id      uuid references public.documents (id) on delete cascade,
  kind             text not null check (kind in ('analysis', 'translation')),
  locale           text check (locale in ('en', 'fr', 'zh')),
  status           text not null default 'running' check (status in ('running', 'done', 'failed', 'aborted')),
  idempotency_key  text not null check (char_length(idempotency_key) <= 200),
  error_kind       text check (char_length(error_kind) <= 40),
  request_id       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index jobs_user_id_status_idx on public.jobs (user_id, status, created_at desc);
create index jobs_document_id_idx on public.jobs (document_id);

alter table public.jobs enable row level security;
revoke all on public.jobs from anon, authenticated;
grant select, insert, update on public.jobs to authenticated;
grant all on public.jobs to service_role;
create policy "jobs: owner can select" on public.jobs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "jobs: owner can insert" on public.jobs
  for insert to authenticated with check (
    user_id = (select auth.uid()) and (document_id is null or public.owns_document(document_id)));
create policy "jobs: owner can update" on public.jobs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Requests in the last minute and analyses still running, for per-user limits.
create function public.my_recent_activity()
returns table (requests_last_minute int, running_analyses int)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.ai_usage
      where user_id = (select auth.uid()) and created_at > now() - interval '1 minute'),
    (select count(*)::int from public.jobs
      where user_id = (select auth.uid()) and kind = 'analysis' and status = 'running'
        and updated_at > now() - interval '10 minutes');
$$;
revoke all on function public.my_recent_activity() from public, anon;
grant execute on function public.my_recent_activity() to authenticated;

-- ───────── messages: answer dedup ─────────
alter table public.messages add column question_hash text check (char_length(question_hash) = 64);
create index messages_document_id_question_hash_idx on public.messages (document_id, question_hash);

-- ───────── feature_flags: runtime switches, service role only ─────────
create table public.feature_flags (
  key         text primary key check (char_length(key) <= 100),
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.feature_flags enable row level security;
revoke all on public.feature_flags from anon, authenticated;
grant all on public.feature_flags to service_role;
-- No policy for authenticated: only server code with the service key reads or writes flags.
