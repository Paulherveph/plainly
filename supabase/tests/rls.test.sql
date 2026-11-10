-- RLS isolation: a user can never read or change another user's rows.
-- Run with: supabase test db
begin;
select plan(17);

-- two users (inserted as postgres, before switching role)
insert into auth.users (id, email, aud, role, is_anonymous)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local', 'authenticated', 'authenticated', true),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local',   'authenticated', 'authenticated', false);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', false)::text, true);
end $$;

-- ── Alice creates a document with children ──
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

insert into public.documents (id, title, media_type, storage_path, status)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Alice lease', 'application/pdf',
        '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/original.pdf', 'ready');
insert into public.analyses (document_id, locale, result, model)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'en', '{}'::jsonb, 'fake');
insert into public.messages (document_id, role, parts)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'user', '[]'::jsonb);
insert into public.deadlines (document_id, label, due_on, quote)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Pay deposit', '2026-11-20', 'deposit');

select is((select count(*)::int from public.documents), 1, 'owner sees her document');
select is((select count(*)::int from public.analyses), 1, 'owner sees her analysis');

-- ── Bob tries everything ──
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');

select is((select count(*)::int from public.documents), 0, 'other user sees no documents');
select is((select count(*)::int from public.analyses), 0, 'other user sees no analyses');
select is((select count(*)::int from public.messages), 0, 'other user sees no messages');
select is((select count(*)::int from public.deadlines), 0, 'other user sees no deadlines');

-- these run without error but touch no rows; the owner checks at the end prove nothing changed
select lives_ok($$update public.documents set title = 'hacked'$$, 'update of another user''s document is a no-op');
select lives_ok($$delete from public.documents$$, 'delete of another user''s document is a no-op');
select lives_ok($$update public.deadlines set done = true$$, 'update of another user''s deadlines is a no-op');

select throws_ok(
  $$insert into public.documents (user_id, title, media_type, storage_path)
    values ('11111111-1111-1111-1111-111111111111', 'spoof', 'text/plain', 'x')$$,
  '42501', null, 'cannot insert a document for someone else');
select throws_ok(
  $$insert into public.messages (document_id, role, parts)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'user', '[]'::jsonb)$$,
  '42501', null, 'cannot attach a message to someone else''s document');
select throws_ok(
  $$insert into public.analyses (document_id, locale, result, model)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'fr', '{}'::jsonb, 'x')$$,
  '42501', null, 'cannot attach an analysis to someone else''s document');
select throws_ok(
  $$insert into public.usage (user_id, day) values ('22222222-2222-2222-2222-222222222222', current_date)$$,
  '42501', null, 'usage is not writable directly');

-- ── storage paths are scoped to the user folder ──
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('documents', '11111111-1111-1111-1111-111111111111/x/original.pdf', '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'cannot upload into another user''s folder');

-- ── anonymous (not signed in) role sees nothing ──
select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.documents$$, '42501', null, 'anon role has no table access');

-- ── Alice still has everything ──
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select title from public.documents), 'Alice lease', 'document unchanged');
select is((select count(*)::int from public.deadlines where done = false), 1, 'deadline unchanged');

select * from finish();
rollback;
