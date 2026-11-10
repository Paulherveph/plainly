-- Quota: guests stop at 5 analyses a day, members at 20, refunds never go below zero.
begin;
select plan(7);

insert into auth.users (id, email, aud, role, is_anonymous) values
  ('33333333-3333-3333-3333-333333333333', null, 'authenticated', 'authenticated', true),
  ('44444444-4444-4444-4444-444444444444', 'm@test.local', 'authenticated', 'authenticated', false);

-- guest
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":true}', true);

select public.consume_quota('analysis') from generate_series(1, 4);
select is((select used from public.consume_quota('analysis')), 5, 'fifth guest analysis is allowed');
select is((select used from public.consume_quota('analysis')), null, 'sixth guest analysis is refused');
select is((select analyses from public.usage), 5, 'counter never passes the limit');

select public.refund_quota('analysis');
select is((select analyses from public.usage), 4, 'refund gives one back');
select is((select used from public.consume_quota('chat')), 1, 'chat is counted separately');

-- member
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","is_anonymous":false}', true);
select is((select quota from public.consume_quota('analysis')), 20, 'members get 20');
select public.refund_quota('analysis'); select public.refund_quota('analysis');
select is((select analyses from public.usage), 0, 'refund never goes below zero');

select * from finish();
rollback;
