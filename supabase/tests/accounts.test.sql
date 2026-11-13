-- S3: profiles, admins, guest merge (E06, G01, G03).
begin;
select plan(14);

insert into auth.users (id, email, aud, role, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', null, 'authenticated', 'authenticated', true),
  ('22222222-2222-2222-2222-222222222222', 'member@test.local', 'authenticated', 'authenticated', false),
  ('33333333-3333-3333-3333-333333333333', 'other@test.local', 'authenticated', 'authenticated', false);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

select is((select count(*)::int from public.profiles where user_id in (
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')),
  3, 'a profile is created for every new user');

-- Guest data
insert into public.documents (id, user_id, title, media_type, storage_path) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Lease', 'application/pdf',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/original.pdf'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Visa', 'application/pdf',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000002/original.pdf');
insert into public.messages (document_id, user_id, role, parts) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'user', '[]');
insert into public.deadlines (document_id, user_id, label, due_on, quote) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Pay', '2026-12-01', 'q');

-- Profiles are private
select pg_temp.act_as('33333333-3333-3333-3333-333333333333');
select is((select count(*)::int from public.profiles), 1, 'a user sees only their own profile');
select lives_ok($$ update public.profiles set display_name = 'Bob' where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'updating someone else''s profile is a no-op');
select throws_ok($$ update public.profiles set plan_id = 'pro' where user_id = '33333333-3333-3333-3333-333333333333' $$,
  '42501', null, 'the plan cannot be changed by the user');
select is(public.is_admin(), false, 'nobody is an admin by default');
select throws_ok($$ select public.merge_guest('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333') $$,
  '42501', null, 'a signed-in user cannot call merge_guest');
select throws_ok($$ select count(*) from public.admins $$, '42501', null, 'admins is not readable by users');
reset role;

select throws_ok($$ select public.merge_guest('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') $$,
  '42501', null, 'merge refuses a source that is not a guest');

select is(public.merge_guest('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'), 2,
  'merge moves both guest documents');
select is((select count(*)::int from public.documents where user_id = '22222222-2222-2222-2222-222222222222'), 2,
  'the member now owns the documents');
select ok((select bool_and(storage_path like '22222222-2222-2222-2222-222222222222/%') from public.documents
  where user_id = '22222222-2222-2222-2222-222222222222'), 'storage paths are rewritten to the member folder');
select is((select count(*)::int from public.messages where user_id = '22222222-2222-2222-2222-222222222222'), 1,
  'messages move');
select is((select count(*)::int from public.deadlines where user_id = '22222222-2222-2222-2222-222222222222'), 1,
  'deadlines move');
select is((select count(*)::int from auth.users where id = '11111111-1111-1111-1111-111111111111'), 0,
  'the guest user is deleted');

select * from finish();
rollback;
