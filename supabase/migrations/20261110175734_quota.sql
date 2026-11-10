-- Daily quota (PRD F10). Guests (anonymous) 5 analyses/day, members 20. Chat: 30 / 100.
-- One atomic statement per call: the conditional UPDATE locks the row, so concurrent
-- requests can never push a counter past the limit.

create function public.quota_limit(p_kind text) returns int
language sql stable set search_path = '' as $$
  select case
    when p_kind = 'analysis' then case when coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then 5 else 20 end
    when p_kind = 'chat'     then case when coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then 30 else 100 end
  end;
$$;

-- Returns the new count, or null when the limit is reached.
create function public.consume_quota(p_kind text) returns table (used int, quota int)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_limit int  := public.quota_limit(p_kind);
  v_used  int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if v_limit is null then raise exception 'unknown quota kind' using errcode = '22023'; end if;

  insert into public.usage (user_id, day) values (v_uid, current_date) on conflict do nothing;

  if p_kind = 'analysis' then
    update public.usage set analyses = analyses + 1
     where user_id = v_uid and day = current_date and analyses < v_limit
     returning analyses into v_used;
  else
    update public.usage set chats = chats + 1
     where user_id = v_uid and day = current_date and chats < v_limit
     returning chats into v_used;
  end if;

  return query select v_used, v_limit;
end $$;

-- Gives one back after a failed run, never below zero.
create function public.refund_quota(p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind = 'analysis' then
    update public.usage set analyses = greatest(analyses - 1, 0) where user_id = auth.uid() and day = current_date;
  elsif p_kind = 'chat' then
    update public.usage set chats = greatest(chats - 1, 0) where user_id = auth.uid() and day = current_date;
  end if;
end $$;

revoke execute on function public.quota_limit(text), public.consume_quota(text), public.refund_quota(text) from public, anon;
grant execute on function public.quota_limit(text), public.consume_quota(text), public.refund_quota(text) to authenticated;
