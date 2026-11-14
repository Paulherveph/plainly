-- Word, Excel, PowerPoint, WebP and text uploads (ADR 18), and user approval from the profiles table (docs/AUTH.md §7).

-- ───────── documents: more file types ─────────
alter table public.documents drop constraint documents_media_type_check;
alter table public.documents add constraint documents_media_type_check check (media_type in (
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
));

update storage.buckets set allowed_mime_types = array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
] where id = 'documents';

-- ───────── profiles: email and approval, mirrored with auth.users ─────────
-- `approved` is auth.users.email_confirmed_at as a checkbox. Ticking it in Studio approves the
-- account (same as entering the emailed code); entering the code ticks it. Users cannot change
-- either column: `authenticated` may only update display_name, locale and theme.
alter table public.profiles
  add column email    text,
  add column approved boolean not null default false;

update public.profiles p
set email = u.email, approved = u.email_confirmed_at is not null
from auth.users u
where u.id = p.user_id;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, locale, email, approved)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'locale' in ('en', 'fr', 'zh') then new.raw_user_meta_data ->> 'locale' else 'en' end,
    new.email,
    new.email_confirmed_at is not null
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

-- auth.users → profiles: a new email, or an approval by code, shows in the profile.
create function public.sync_profile_from_auth() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
  set email = new.email, approved = new.email_confirmed_at is not null
  where user_id = new.id
    and (email is distinct from new.email or approved is distinct from (new.email_confirmed_at is not null));
  return new;
end $$;
revoke all on function public.sync_profile_from_auth() from public, anon, authenticated;

create trigger on_auth_user_updated
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_profile_from_auth();

-- profiles → auth.users: ticking `approved` confirms the email, unticking clears it.
create function public.check_profile_approval() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.approved and new.email is null then
    raise exception 'This user has no email (a guest), so there is nothing to approve.';
  end if;
  return new;
end $$;
revoke all on function public.check_profile_approval() from public, anon, authenticated;

create trigger on_profile_approval_check
  before update of approved on public.profiles
  for each row when (old.approved is distinct from new.approved)
  execute function public.check_profile_approval();

create function public.sync_auth_from_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update auth.users
  set email_confirmed_at = case when new.approved then coalesce(email_confirmed_at, now()) end
  where id = new.user_id and (email_confirmed_at is not null) is distinct from new.approved;
  return new;
end $$;
revoke all on function public.sync_auth_from_profile() from public, anon, authenticated;

create trigger on_profile_approved
  after update of approved on public.profiles
  for each row when (old.approved is distinct from new.approved)
  execute function public.sync_auth_from_profile();

-- ───────── user_overview: one row per user, for Studio and support (service role only) ─────────
create view public.user_overview with (security_invoker = true) as
select
  p.email,
  p.approved,
  u.is_anonymous                                              as guest,
  public.effective_plan(p.user_id)                            as plan,
  coalesce(b.plan_credits, 0) + coalesce(b.pack_credits, 0)   as credits,
  (select count(*) from public.documents d where d.user_id = p.user_id) as documents,
  p.created_at,
  u.last_sign_in_at,
  p.user_id
from public.profiles p
join auth.users u on u.id = p.user_id
left join public.credit_balances b on b.user_id = p.user_id;

revoke all on public.user_overview from public, anon, authenticated;
grant select on public.user_overview to service_role;
