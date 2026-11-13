-- S4: credits, plans and billing (docs/PRICING.md sections 3 and 4).
-- Plans are data. Balances change only through the functions below; every change writes a ledger
-- row with an idempotency key, so a retried request never charges twice.

-- ───────── plans ─────────
create table public.plans (
  id            text primary key,
  name          text not null,
  kind          text not null check (kind in ('guest', 'free', 'subscription', 'pack')),
  price_cents   int not null default 0 check (price_cents >= 0),
  currency      text not null default 'usd',
  interval      text not null default 'none' check (interval in ('none', 'month', 'year', 'once')),
  entitlements  jsonb not null,
  active        boolean not null default true,
  sort          int not null default 0
);
alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;
grant all on public.plans to service_role;
create policy "plans: everyone can read active plans" on public.plans
  for select to anon, authenticated using (active);

-- credits: per period (once for guest and packs). Limits are per document. Retention in days.
insert into public.plans (id, name, kind, price_cents, interval, sort, active, entitlements) values
  ('guest', 'Guest', 'guest', 0, 'none', 0, true,
   '{"credits":8,"maxPages":5,"maxBytes":5242880,"retentionDays":7,"deepChat":false,"allLocales":false,"concurrency":1,"packs":false}'),
  ('free', 'Free', 'free', 0, 'month', 1, true,
   '{"credits":24,"maxPages":10,"maxBytes":10485760,"retentionDays":30,"deepChat":false,"allLocales":false,"concurrency":1,"packs":true}'),
  ('pro_month', 'Pro', 'subscription', 1200, 'month', 2, true,
   '{"credits":400,"maxPages":40,"maxBytes":20971520,"retentionDays":180,"deepChat":true,"allLocales":true,"concurrency":3,"packs":true}'),
  ('pro_year', 'Pro (yearly)', 'subscription', 9900, 'year', 3, true,
   '{"credits":400,"maxPages":40,"maxBytes":20971520,"retentionDays":180,"deepChat":true,"allLocales":true,"concurrency":3,"packs":true}'),
  ('max_month', 'Max', 'subscription', 3900, 'month', 4, false,
   '{"credits":1500,"maxPages":100,"maxBytes":31457280,"retentionDays":365,"deepChat":true,"allLocales":true,"concurrency":5,"packs":true}'),
  ('pack_200', '200 credits', 'pack', 500, 'once', 10, true, '{"credits":200}');

alter table public.profiles add constraint profiles_plan_id_fkey foreign key (plan_id) references public.plans (id);

-- ───────── subscriptions ─────────
create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users (id) on delete set null,
  plan_id                   text not null references public.plans (id),
  status                    text not null check (status in ('active', 'past_due', 'canceled', 'trialing')),
  provider                  text not null,
  provider_customer_id      text,
  provider_subscription_id  text not null,
  current_period_start      timestamptz not null,
  current_period_end        timestamptz not null,
  cancel_at_period_end      boolean not null default false,
  past_due_since            timestamptz,
  last_event_at             timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);
create index subscriptions_user_id_idx on public.subscriptions (user_id, status);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
create policy "subscriptions: owner can select" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

-- ───────── balances, holds, ledger ─────────
create table public.credit_balances (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  plan_credits  int not null default 0 check (plan_credits >= 0),
  pack_credits  int not null default 0 check (pack_credits >= 0),
  plan_id       text references public.plans (id),
  period_key    text,
  period_end    timestamptz,
  low_nudged    text,
  updated_at    timestamptz not null default now()
);
alter table public.credit_balances enable row level security;
revoke all on public.credit_balances from anon, authenticated;
grant select on public.credit_balances to authenticated;
grant all on public.credit_balances to service_role;
create policy "credit_balances: owner can select" on public.credit_balances
  for select to authenticated using (user_id = (select auth.uid()));

create table public.credit_holds (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  plan_amount      int not null check (plan_amount >= 0),
  pack_amount      int not null check (pack_amount >= 0),
  status           text not null default 'held' check (status in ('held', 'settled', 'released')),
  idempotency_key  text not null unique check (char_length(idempotency_key) <= 200),
  created_at       timestamptz not null default now(),
  closed_at        timestamptz
);
create index credit_holds_user_id_idx on public.credit_holds (user_id, status);
alter table public.credit_holds enable row level security;
revoke all on public.credit_holds from anon, authenticated;
grant select on public.credit_holds to authenticated;
grant all on public.credit_holds to service_role;
create policy "credit_holds: owner can select" on public.credit_holds
  for select to authenticated using (user_id = (select auth.uid()));

-- Append-only. user_id becomes null after an account is deleted (financial record, no identity).
-- Invariant: for a user, sum(delta) = plan_credits + pack_credits.
create table public.credit_ledger (
  id               bigint generated always as identity primary key,
  user_id          uuid references auth.users (id) on delete set null,
  delta            int not null,
  bucket           text not null check (bucket in ('plan', 'pack')),
  reason           text not null check (reason in
                     ('grant', 'hold', 'settle_refund', 'release', 'pack', 'reversal', 'adjust')),
  ref_type         text,
  ref_id           text,
  idempotency_key  text not null unique check (char_length(idempotency_key) <= 220),
  created_at       timestamptz not null default now()
);
create index credit_ledger_user_id_idx on public.credit_ledger (user_id, created_at desc);
alter table public.credit_ledger enable row level security;
revoke all on public.credit_ledger from anon, authenticated;
grant select on public.credit_ledger to authenticated;
grant all on public.credit_ledger to service_role;
create policy "credit_ledger: owner can select" on public.credit_ledger
  for select to authenticated using (user_id = (select auth.uid()));

-- ───────── billing_events: webhook inbox, processed once ─────────
create table public.billing_events (
  id                 bigint generated always as identity primary key,
  provider           text not null,
  provider_event_id  text not null,
  type               text not null,
  occurred_at        timestamptz not null,
  payload            jsonb not null,
  processed_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique (provider, provider_event_id)
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
grant all on public.billing_events to service_role;

-- ───────── the plan a user has right now ─────────
-- Paid access lasts to the end of a cancelled period and through a 3-day past_due grace (F10, F11).
create function public.effective_plan(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.plan_id from public.subscriptions s
      where s.user_id = p_user
        and (s.status in ('active', 'trialing')
             or (s.status = 'past_due' and s.past_due_since > now() - interval '3 days')
             or (s.status = 'canceled' and s.current_period_end > now()))
      order by s.current_period_end desc limit 1),
    (select case when u.is_anonymous then 'guest' else 'free' end from auth.users u where u.id = p_user),
    'guest');
$$;
revoke all on function public.effective_plan(uuid) from public, anon, authenticated;
grant execute on function public.effective_plan(uuid) to service_role;

-- ───────── grant_period_credits: lazy, idempotent per period (no cron) ─────────
create function public.grant_period_credits(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_plan text := public.effective_plan(p_user);
  v_credits int;
  v_period text;
  v_end timestamptz;
  v_old int;
  v_confirmed boolean;
  v_status text;
begin
  select (p.entitlements ->> 'credits')::int into v_credits from public.plans p where p.id = v_plan;
  insert into public.credit_balances (user_id, plan_id) values (p_user, v_plan) on conflict (user_id) do nothing;

  if v_plan = 'guest' then
    v_period := 'guest:once';
  elsif v_plan = 'free' then
    -- E14: monthly credits wait until the email is verified (prevents farming with fake emails).
    select (u.email_confirmed_at is not null) into v_confirmed from auth.users u where u.id = p_user;
    if not coalesce(v_confirmed, false) then
      update public.credit_balances set plan_id = v_plan where user_id = p_user;
      return;
    end if;
    v_period := 'free:' || to_char(now() at time zone 'utc', 'YYYY-MM');
    v_end := (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc';
  else
    select s.status, s.current_period_end into v_status, v_end
      from public.subscriptions s
     where s.user_id = p_user and s.plan_id = v_plan
     order by s.current_period_end desc limit 1;
    -- F10: past_due keeps access during the grace, but grants nothing new.
    if v_status is null or v_status = 'past_due' then
      update public.credit_balances set plan_id = v_plan where user_id = p_user;
      return;
    end if;
    -- Paid plans (monthly or yearly) grant once per calendar month while active.
    v_period := v_plan || ':' || to_char(now() at time zone 'utc', 'YYYY-MM');
    v_end := least(v_end, (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc');
  end if;

  select plan_credits into v_old from public.credit_balances where user_id = p_user for update;
  begin
    insert into public.credit_ledger (user_id, delta, bucket, reason, ref_type, ref_id, idempotency_key)
    values (p_user, v_credits - v_old, 'plan', 'grant', 'plan', v_plan, 'grant:' || p_user || ':' || v_period);
  exception when unique_violation then
    update public.credit_balances set plan_id = v_plan where user_id = p_user;
    return; -- already granted for this period
  end;
  -- Unused plan credits do not roll over; pack credits never expire.
  update public.credit_balances
     set plan_credits = v_credits, plan_id = v_plan, period_key = v_period, period_end = v_end,
         low_nudged = null, updated_at = now()
   where user_id = p_user;
end $$;
revoke all on function public.grant_period_credits(uuid) from public, anon, authenticated;
grant execute on function public.grant_period_credits(uuid) to service_role;

-- ───────── reserve, settle, release (always for auth.uid()) ─────────
create function public.reserve_credits(p_amount int, p_key text)
returns table (hold_id uuid, available int)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_plan int;
  v_pack int;
  v_from_plan int;
  v_from_pack int;
  v_hold uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_amount < 0 or p_amount > 1000 then raise exception 'bad amount' using errcode = '22023'; end if;

  perform public.grant_period_credits(v_uid);
  -- Row lock: concurrent reservations queue here, so the balance never goes negative (F04).
  select b.plan_credits, b.pack_credits into v_plan, v_pack
    from public.credit_balances b where b.user_id = v_uid for update;

  -- Same key again (a retried request): the same hold, never a second charge.
  select h.id into v_hold from public.credit_holds h where h.idempotency_key = p_key and h.user_id = v_uid;
  if v_hold is not null then
    return query select v_hold, v_plan + v_pack;
    return;
  end if;

  if v_plan + v_pack < p_amount then
    return query select null::uuid, v_plan + v_pack;
    return;
  end if;

  v_from_plan := least(v_plan, p_amount);
  v_from_pack := p_amount - v_from_plan;
  update public.credit_balances
     set plan_credits = plan_credits - v_from_plan, pack_credits = pack_credits - v_from_pack, updated_at = now()
   where user_id = v_uid;
  insert into public.credit_holds (user_id, plan_amount, pack_amount, idempotency_key)
  values (v_uid, v_from_plan, v_from_pack, p_key) returning id into v_hold;
  if v_from_plan > 0 then
    insert into public.credit_ledger (user_id, delta, bucket, reason, ref_type, ref_id, idempotency_key)
    values (v_uid, -v_from_plan, 'plan', 'hold', 'hold', v_hold, 'hold:plan:' || v_hold);
  end if;
  if v_from_pack > 0 then
    insert into public.credit_ledger (user_id, delta, bucket, reason, ref_type, ref_id, idempotency_key)
    values (v_uid, -v_from_pack, 'pack', 'hold', 'hold', v_hold, 'hold:pack:' || v_hold);
  end if;
  return query select v_hold, v_plan + v_pack - p_amount;
end $$;

-- Converts a hold into a charge of p_final (at most the held amount); the rest goes back, pack first.
create function public.settle_credits(p_hold uuid, p_final int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  h public.credit_holds;
  v_refund int;
  v_pack_back int;
  v_plan_back int;
begin
  select * into h from public.credit_holds where id = p_hold and user_id = v_uid for update;
  if h.id is null or h.status <> 'held' then return; end if;
  v_refund := greatest(0, h.plan_amount + h.pack_amount - greatest(p_final, 0));
  v_pack_back := least(v_refund, h.pack_amount);
  v_plan_back := v_refund - v_pack_back;
  update public.credit_holds set status = 'settled', closed_at = now() where id = h.id;
  if v_refund > 0 then
    update public.credit_balances
       set plan_credits = plan_credits + v_plan_back, pack_credits = pack_credits + v_pack_back, updated_at = now()
     where user_id = v_uid;
    if v_plan_back > 0 then
      insert into public.credit_ledger (user_id, delta, bucket, reason, ref_type, ref_id, idempotency_key)
      values (v_uid, v_plan_back, 'plan', 'settle_refund', 'hold', h.id, 'settle:plan:' || h.id);
    end if;
    if v_pack_back > 0 then
      insert into public.credit_ledger (user_id, delta, bucket, reason, ref_type, ref_id, idempotency_key)
      values (v_uid, v_pack_back, 'pack', 'settle_refund', 'hold', h.id, 'settle:pack:' || h.id);
    end if;
  end if;
end $$;

-- F05: a failed call gives everything back.
create function public.release_credits(p_hold uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  h public.credit_holds;
begin
  select * into h from public.credit_holds where id = p_hold and user_id = v_uid for update;
  if h.id is null or h.status <> 'held' then return; end if;
  update public.credit_holds set status = 'released', closed_at = now() where id = h.id;
  update public.credit_balances
     set plan_credits = plan_credits + h.plan_amount, pack_credits = pack_credits + h.pack_amount, updated_at = now()
   where user_id = v_uid;
  if h.plan_amount > 0 then
    insert into public.credit_ledger (user_id, delta, bucket, reason, ref_type, ref_id, idempotency_key)
    values (v_uid, h.plan_amount, 'plan', 'release', 'hold', h.id, 'release:plan:' || h.id);
  end if;
  if h.pack_amount > 0 then
    insert into public.credit_ledger (user_id, delta, bucket, reason, ref_type, ref_id, idempotency_key)
    values (v_uid, h.pack_amount, 'pack', 'release', 'hold', h.id, 'release:pack:' || h.id);
  end if;
end $$;

-- The caller's balance after a lazy grant, with the facts the UI needs.
create function public.my_credits()
returns table (plan_id text, plan_credits int, pack_credits int, period_end timestamptz,
               plan_total int, low_nudged text, period_key text, email_verified boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  perform public.grant_period_credits(v_uid);
  return query
    select b.plan_id, b.plan_credits, b.pack_credits, b.period_end,
           (p.entitlements ->> 'credits')::int, b.low_nudged, b.period_key,
           (select u.email_confirmed_at is not null from auth.users u where u.id = v_uid)
      from public.credit_balances b join public.plans p on p.id = b.plan_id
     where b.user_id = v_uid;
end $$;

-- The low-credit nudge shows once per period.
create function public.mark_low_nudged() returns void
language sql security definer set search_path = '' as $$
  update public.credit_balances set low_nudged = period_key where user_id = (select auth.uid());
$$;

-- Plan facts for entitlement checks (never from the client).
create function public.my_plan()
returns table (plan_id text, entitlements jsonb, email_verified boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.entitlements, (u.email_confirmed_at is not null)
    from auth.users u join public.plans p on p.id = public.effective_plan(u.id)
   where u.id = (select auth.uid());
$$;

revoke all on function public.reserve_credits(int, text) from public, anon;
revoke all on function public.settle_credits(uuid, int) from public, anon;
revoke all on function public.release_credits(uuid) from public, anon;
revoke all on function public.my_credits() from public, anon;
revoke all on function public.mark_low_nudged() from public, anon;
revoke all on function public.my_plan() from public, anon;
grant execute on function public.reserve_credits(int, text) to authenticated;
grant execute on function public.settle_credits(uuid, int) to authenticated;
grant execute on function public.release_credits(uuid) to authenticated;
grant execute on function public.my_credits() to authenticated;
grant execute on function public.mark_low_nudged() to authenticated;
grant execute on function public.my_plan() to authenticated;

-- ───────── service-side changes (billing webhooks) ─────────
create function public.grant_pack_credits(p_user uuid, p_credits int, p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.credit_balances (user_id) values (p_user) on conflict (user_id) do nothing;
  begin
    insert into public.credit_ledger (user_id, delta, bucket, reason, ref_type, ref_id, idempotency_key)
    values (p_user, p_credits, 'pack', 'pack', 'billing', p_key, 'pack:' || p_key);
  exception when unique_violation then
    return false; -- already granted (duplicate webhook)
  end;
  update public.credit_balances set pack_credits = pack_credits + p_credits, updated_at = now()
   where user_id = p_user;
  return true;
end $$;

-- F14: a refund or chargeback reverses what is still unused. Returns what could not be reversed.
create function public.reverse_credits(p_user uuid, p_bucket text, p_credits int, p_key text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_have int;
  v_take int;
begin
  if p_bucket not in ('plan', 'pack') then raise exception 'bad bucket' using errcode = '22023'; end if;
  select case when p_bucket = 'pack' then pack_credits else plan_credits end into v_have
    from public.credit_balances where user_id = p_user for update;
  v_take := least(coalesce(v_have, 0), greatest(p_credits, 0));
  begin
    insert into public.credit_ledger (user_id, delta, bucket, reason, ref_type, ref_id, idempotency_key)
    values (p_user, -v_take, p_bucket, 'reversal', 'billing', p_key, 'reversal:' || p_key);
  exception when unique_violation then
    return 0;
  end;
  if p_bucket = 'pack' then
    update public.credit_balances set pack_credits = pack_credits - v_take where user_id = p_user;
  else
    update public.credit_balances set plan_credits = plan_credits - v_take where user_id = p_user;
  end if;
  return p_credits - v_take;
end $$;
revoke all on function public.grant_pack_credits(uuid, int, text) from public, anon, authenticated;
revoke all on function public.reverse_credits(uuid, text, int, text) from public, anon, authenticated;
grant execute on function public.grant_pack_credits(uuid, int, text) to service_role;
grant execute on function public.reverse_credits(uuid, text, int, text) to service_role;

-- ───────── credits replace the daily quota ─────────
drop function if exists public.consume_quota(text);
drop function if exists public.refund_quota(text);
drop function if exists public.quota_limit(text);
drop table if exists public.usage;
