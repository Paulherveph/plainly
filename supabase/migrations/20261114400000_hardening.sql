-- S6: legal acceptance records (G08), analysis versions (B20), admin read model.

create table public.legal_acceptances (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  document     text not null check (document in ('terms', 'privacy')),
  version      text not null check (char_length(version) <= 40),
  accepted_at  timestamptz not null default now(),
  unique (user_id, document, version)
);
alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from anon, authenticated;
grant select on public.legal_acceptances to authenticated;
grant all on public.legal_acceptances to service_role;
create policy "legal_acceptances: owner can select" on public.legal_acceptances
  for select to authenticated using (user_id = (select auth.uid()));

-- Records acceptance for the caller (idempotent per version).
create function public.accept_legal(p_terms text, p_privacy text) returns void
language sql security definer set search_path = '' as $$
  insert into public.legal_acceptances (user_id, document, version)
  values ((select auth.uid()), 'terms', p_terms), ((select auth.uid()), 'privacy', p_privacy)
  on conflict do nothing;
$$;
revoke all on function public.accept_legal(text, text) from public, anon;
grant execute on function public.accept_legal(text, text) to authenticated;

-- B20: which prompt version produced a stored analysis.
alter table public.analyses add column analysis_version text not null default 'a2';

-- /admin: cost today, error rate, request counts. Admins only (checked inside).
create function public.admin_stats()
returns table (spend_today_micros bigint, requests_24h int, failed_24h int, fallbacks_24h int,
               analyses_today int, active_subscriptions int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return query select
    public.ai_spend_today(),
    (select count(distinct request_id)::int from public.ai_usage where created_at > now() - interval '24 hours'),
    (select count(*)::int from public.ai_usage where created_at > now() - interval '24 hours' and status = 'failed'),
    (select count(*)::int from (select request_id from public.ai_usage
       where created_at > now() - interval '24 hours' group by request_id, profile having count(*) > 1) f),
    (select count(*)::int from public.analyses where created_at > date_trunc('day', now())),
    (select count(*)::int from public.subscriptions where status in ('active', 'trialing'));
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
