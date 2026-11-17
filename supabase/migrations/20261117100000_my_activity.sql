-- Account page activity graph: the caller's documents explained and questions asked, per UTC day.
-- ai_usage is append-only and survives document deletion, so the graph keeps a full year.
create or replace function public.my_activity(p_days int default 371)
returns table (day date, analyses int, questions int)
language sql stable security definer set search_path = '' as $$
  select (u.created_at at time zone 'utc')::date as day,
         (count(*) filter (where u.profile = 'analysis'))::int as analyses,
         (count(*) filter (where u.profile in ('chat', 'chat_deep')))::int as questions
  from public.ai_usage u
  where u.user_id = (select auth.uid())
    and u.status in ('ok', 'cache_hit')
    and u.profile in ('analysis', 'chat', 'chat_deep')
    and u.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 400))
  group by 1
  order by 1;
$$;

revoke all on function public.my_activity(int) from public, anon;
grant execute on function public.my_activity(int) to authenticated;
