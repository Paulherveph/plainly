-- S3: accounts. Profiles, admins, guest merge, stale guest cleanup (docs/AUTH.md).

-- ───────── profiles: one row per auth user, created by trigger ─────────
create table public.profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 80),
  locale        text not null default 'en' check (locale in ('en', 'fr', 'zh')),
  theme         text not null default 'system' check (theme in ('system', 'light', 'dark')),
  plan_id       text,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, update (display_name, locale, theme) on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy "profiles: owner can select" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: owner can update" on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, locale)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'locale' in ('en', 'fr', 'zh') then new.raw_user_meta_data ->> 'locale' else 'en' end
  )
  on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing users get a profile too.
insert into public.profiles (user_id) select id from auth.users on conflict do nothing;

-- ───────── admins: never from a client claim (docs/AUTH.md section 5) ─────────
create table public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant all on public.admins to service_role;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ───────── merge_guest: move a guest's data into an existing account, one transaction ─────────
-- Called only by server code with the service key, after the server verified a signed cookie.
create function public.merge_guest(p_guest uuid, p_user uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_moved int;
begin
  if p_guest = p_user then
    raise exception 'same user' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_guest and is_anonymous) then
    raise exception 'source is not a guest' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user and not is_anonymous) then
    raise exception 'target is not a member' using errcode = '42501';
  end if;

  update public.documents
     set user_id = p_user,
         storage_path = p_user::text || substr(storage_path, char_length(p_guest::text) + 1)
   where user_id = p_guest;
  get diagnostics v_moved = row_count;

  update public.analyses       set user_id = p_user where user_id = p_guest;
  update public.messages       set user_id = p_user where user_id = p_guest;
  update public.deadlines      set user_id = p_user where user_id = p_guest;
  update public.document_pages set user_id = p_user where user_id = p_guest;
  update public.jobs           set user_id = p_user where user_id = p_guest;
  update public.ai_usage       set user_id = p_user where user_id = p_guest;

  delete from public.analysis_cache c
   where c.user_id = p_guest
     and exists (select 1 from public.analysis_cache m where m.user_id = p_user and m.cache_key = c.cache_key);
  update public.analysis_cache set user_id = p_user where user_id = p_guest;

  delete from auth.users where id = p_guest;
  return v_moved;
end $$;
revoke all on function public.merge_guest(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_guest(uuid, uuid) to service_role;

-- ───────── stale guests: anonymous users with nothing left, after N days ─────────
create function public.delete_stale_guests(p_days int default 30) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  delete from auth.users u
   where u.is_anonymous
     and u.created_at < now() - make_interval(days => greatest(p_days, 1))
     and not exists (select 1 from public.documents d where d.user_id = u.id);
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.delete_stale_guests(int) from public, anon, authenticated;
grant execute on function public.delete_stale_guests(int) to service_role;
