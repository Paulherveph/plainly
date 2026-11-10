-- Plainly — initial schema (PRD section 8).
-- Every table has RLS. Ownership is always `user_id = (select auth.uid())`.
-- Child rows (analyses, messages, deadlines) must also point at a document the user owns.

-- ───────────────────────── documents ─────────────────────────
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  kind            text check (char_length(kind) <= 60),
  source_lang     text check (source_lang in ('en', 'fr', 'zh', 'other')),
  media_type      text not null check (media_type in ('application/pdf', 'image/png', 'image/jpeg', 'text/plain')),
  storage_path    text not null,
  page_count      int not null default 1 check (page_count between 1 and 20),
  extracted_text  text,  -- pages separated by \f; used to verify quotes and ground chat
  status          text not null default 'uploaded' check (status in ('uploaded', 'analyzing', 'ready', 'failed')),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '30 days'
);
create index documents_user_id_created_at_idx on public.documents (user_id, created_at desc);
create index documents_expires_at_idx on public.documents (expires_at);

-- ───────────────────────── analyses ─────────────────────────
create table public.analyses (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.documents (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  locale          text not null check (locale in ('en', 'fr', 'zh')),
  result          jsonb not null,
  model           text not null,
  dropped_claims  int not null default 0 check (dropped_claims >= 0),
  created_at      timestamptz not null default now(),
  unique (document_id, locale)
);
create index analyses_user_id_idx on public.analyses (user_id);

-- ───────────────────────── messages ─────────────────────────
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.documents (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  parts           jsonb not null,
  created_at      timestamptz not null default now()
);
create index messages_document_id_created_at_idx on public.messages (document_id, created_at);
create index messages_user_id_idx on public.messages (user_id);

-- ───────────────────────── deadlines ─────────────────────────
create table public.deadlines (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.documents (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label           text not null check (char_length(label) between 1 and 300),
  detail          text,
  due_on          date not null,
  quote           text not null,
  page            int check (page > 0),
  done            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index deadlines_user_id_due_on_idx on public.deadlines (user_id, due_on);
create index deadlines_document_id_idx on public.deadlines (document_id);

-- ───────────────────────── usage ─────────────────────────
create table public.usage (
  user_id         uuid not null references auth.users (id) on delete cascade,
  day             date not null,
  analyses        int not null default 0 check (analyses >= 0),
  chats           int not null default 0 check (chats >= 0),
  primary key (user_id, day)
);

-- ───────────────────────── privileges ─────────────────────────
-- The Data API only sees what we grant. Guests and members both use the `authenticated` role.
revoke all on public.documents, public.analyses, public.messages, public.deadlines, public.usage from anon, authenticated;
grant select, insert, update, delete on public.documents, public.analyses, public.messages, public.deadlines to authenticated;
grant select on public.usage to authenticated; -- writes only through consume_quota()

-- ───────────────────────── RLS ─────────────────────────
alter table public.documents enable row level security;
alter table public.analyses  enable row level security;
alter table public.messages  enable row level security;
alter table public.deadlines enable row level security;
alter table public.usage     enable row level security;

-- documents
create policy "documents: owner can select" on public.documents for select to authenticated
  using (user_id = (select auth.uid()));
create policy "documents: owner can insert" on public.documents for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "documents: owner can update" on public.documents for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "documents: owner can delete" on public.documents for delete to authenticated
  using (user_id = (select auth.uid()));

-- helper used by child-table policies; security definer so it is not itself filtered twice
create function public.owns_document(p_document_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documents d where d.id = p_document_id and d.user_id = (select auth.uid())
  );
$$;
revoke execute on function public.owns_document(uuid) from public, anon;
grant execute on function public.owns_document(uuid) to authenticated;

-- analyses, messages, deadlines: same four policies, plus the parent-document check on writes
do $$
declare t text;
begin
  foreach t in array array['analyses', 'messages', 'deadlines'] loop
    execute format($p$create policy "%1$s: owner can select" on public.%1$I for select to authenticated
      using (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "%1$s: owner can insert" on public.%1$I for insert to authenticated
      with check (user_id = (select auth.uid()) and public.owns_document(document_id))$p$, t);
    execute format($p$create policy "%1$s: owner can update" on public.%1$I for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()) and public.owns_document(document_id))$p$, t);
    execute format($p$create policy "%1$s: owner can delete" on public.%1$I for delete to authenticated
      using (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

-- usage: read your own counters
create policy "usage: owner can select" on public.usage for select to authenticated
  using (user_id = (select auth.uid()));

-- ───────────────────────── storage ─────────────────────────
-- Private bucket. Path: {user_id}/{document_id}/original.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'text/plain'])
on conflict (id) do nothing;

create policy "documents bucket: owner can read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents bucket: owner can upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents bucket: owner can update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents bucket: owner can delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
