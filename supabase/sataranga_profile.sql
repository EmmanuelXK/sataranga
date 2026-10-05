-- SATARANGA progress on the shared YUDO project.
-- Identity stays in auth.users / public.profiles. Do not alter oomi_* or rating_stats.
-- Applied on project sphswtyzxaanjcibnnln. Not run by the app's PGLite migrate.

create table if not exists public.sataranga_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coins integer not null default 0,
  rating integer not null default 400,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  heads integer not null default 0,
  streak integer not null default 0,
  last_claim text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.sataranga_profile enable row level security;

drop policy if exists sataranga_profile_select_own on public.sataranga_profile;
drop policy if exists sataranga_profile_insert_own on public.sataranga_profile;
drop policy if exists sataranga_profile_update_own on public.sataranga_profile;

create policy sataranga_profile_select_own
  on public.sataranga_profile
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy sataranga_profile_insert_own
  on public.sataranga_profile
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy sataranga_profile_update_own
  on public.sataranga_profile
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.sataranga_profile from anon;
grant select, insert, update on public.sataranga_profile to authenticated;
