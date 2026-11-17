-- Account activity graph: my_activity() counts only the caller's own explained documents and questions.
begin;
select plan(5);

insert into auth.users (id, email, aud, role, is_anonymous) values
  ('44444444-4444-4444-4444-444444444444', 'ada@test.local', 'authenticated', 'authenticated', false),
  ('55555555-5555-5555-5555-555555555555', 'bob@test.local', 'authenticated', 'authenticated', false);

insert into public.ai_usage (user_id, request_id, profile, provider, model, status, created_at) values
  ('44444444-4444-4444-4444-444444444444', 'r1', 'analysis', 'fake', 'fake', 'ok', now()),
  ('44444444-4444-4444-4444-444444444444', 'r2', 'chat', 'fake', 'fake', 'ok', now()),
  ('44444444-4444-4444-4444-444444444444', 'r3', 'chat_deep', 'fake', 'fake', 'ok', now()),
  ('44444444-4444-4444-4444-444444444444', 'r4', 'fast', 'fake', 'fake', 'ok', now()),
  ('44444444-4444-4444-4444-444444444444', 'r5', 'analysis', 'fake', 'fake', 'failed', now()),
  ('44444444-4444-4444-4444-444444444444', 'r6', 'analysis', 'fake', 'fake', 'ok', now() - interval '3 days'),
  ('55555555-5555-5555-5555-555555555555', 'r7', 'analysis', 'fake', 'fake', 'ok', now());

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

select pg_temp.act_as('44444444-4444-4444-4444-444444444444');
select is((select count(*)::int from public.my_activity()), 2, 'one row per active day, own rows only');
select is((select sum(analyses)::int from public.my_activity()), 2, 'successful analyses are counted, failed ones are not');
select is((select sum(questions)::int from public.my_activity()), 2, 'chat and deep chat count as questions; internal steps do not');

select pg_temp.act_as('55555555-5555-5555-5555-555555555555');
select is((select sum(analyses)::int from public.my_activity()), 1, 'another user sees only their own activity');

reset role;
select throws_ok($$ set local role anon; select * from public.my_activity() $$, '42501', null,
  'guests without a session cannot call it');

select * from finish();
rollback;
