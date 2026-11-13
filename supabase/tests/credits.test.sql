-- S4: credit functions (F02, F03, F05, F06, F15, E14) and the ledger invariant.
begin;
select plan(16);

insert into auth.users (id, email, aud, role, is_anonymous, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', null, 'authenticated', 'authenticated', true, null),
  ('22222222-2222-2222-2222-222222222222', 'free@test.local', 'authenticated', 'authenticated', false, now()),
  ('33333333-3333-3333-3333-333333333333', 'unverified@test.local', 'authenticated', 'authenticated', false, null);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

-- Guest: 8 credits once.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select plan_credits from public.my_credits()), 8, 'a guest gets 8 credits');
select is((select available from public.reserve_credits(3, 'k1')), 5, 'reserving 3 leaves 5');
select is((select available from public.reserve_credits(3, 'k1')), 5, 'the same key again does not charge twice');
select is((select hold_id from public.reserve_credits(6, 'k2')), null, 'insufficient credits returns no hold (F03)');

-- Release gives everything back (F05).
select public.release_credits((select id from public.credit_holds where idempotency_key = 'k1'));
select is((select plan_credits from public.my_credits()), 8, 'a failed call leaves the balance unchanged');

-- Settle for less refunds the difference.
select public.settle_credits((select hold_id from public.reserve_credits(5, 'k3')), 3);
select is((select plan_credits from public.my_credits()), 5, 'settling 3 of 5 refunds 2');
select public.settle_credits((select id from public.credit_holds where idempotency_key = 'k3'), 0);
select is((select plan_credits from public.my_credits()), 5, 'a settled hold cannot be settled again');

-- A zero-cost action (cache hit, sample) never touches the balance (F06).
select is((select available from public.reserve_credits(0, 'k-free')), 5, 'a 0-credit reservation costs nothing');

select is(
  (select sum(delta)::int from public.credit_ledger where user_id = '11111111-1111-1111-1111-111111111111'),
  (select plan_credits + pack_credits from public.credit_balances where user_id = '11111111-1111-1111-1111-111111111111'),
  'ledger sum equals the balance');
select throws_ok($$ select public.grant_pack_credits('11111111-1111-1111-1111-111111111111', 999, 'x') $$,
  '42501', null, 'users cannot grant themselves credits');

-- Free member with a verified email: 24 per month, granted lazily and once (F02).
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select plan_credits from public.my_credits()), 24, 'a verified Free member gets 24 credits');
select is((select plan_credits from public.my_credits()), 24, 'the monthly grant is idempotent');

-- E14: no monthly credits before the email is verified.
select pg_temp.act_as('33333333-3333-3333-3333-333333333333');
select is((select coalesce(plan_credits, 0) from public.my_credits()), 0, 'an unverified member waits for credits');
reset role;

-- Packs come after plan credits and are granted once per event (F15).
select is(public.grant_pack_credits('22222222-2222-2222-2222-222222222222', 200, 'evt-1'), true, 'a pack is granted');
select is(public.grant_pack_credits('22222222-2222-2222-2222-222222222222', 200, 'evt-1'), false, 'a duplicate event grants nothing');
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select public.reserve_credits(30, 'k4');
select is((select pack_credits from public.credit_balances), 194, 'plan credits are used first, then pack credits');
reset role;

select * from finish();
rollback;
