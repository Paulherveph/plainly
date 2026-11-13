-- S6: legal acceptance (G08) and admin-only stats.
begin;
select plan(4);

insert into auth.users (id, email, aud, role, is_anonymous) values
  ('44444444-4444-4444-4444-444444444444', 'legal@test.local', 'authenticated', 'authenticated', false),
  ('55555555-5555-5555-5555-555555555555', 'admin@test.local', 'authenticated', 'authenticated', false);
insert into public.admins (user_id) values ('55555555-5555-5555-5555-555555555555');

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

select pg_temp.act_as('44444444-4444-4444-4444-444444444444');
select public.accept_legal('2026-11-14', '2026-11-14');
select public.accept_legal('2026-11-14', '2026-11-14');
select is((select count(*)::int from public.legal_acceptances), 2, 'acceptance is recorded once per document and version');
select throws_ok($$ select * from public.admin_stats() $$, '42501', null, 'non-admins cannot read admin stats');

select pg_temp.act_as('55555555-5555-5555-5555-555555555555');
select is(public.is_admin(), true, 'an admins row grants admin');
select lives_ok($$ select * from public.admin_stats() $$, 'admins can read stats');
reset role;

select * from finish();
rollback;
