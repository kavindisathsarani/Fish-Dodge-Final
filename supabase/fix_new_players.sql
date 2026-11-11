-- ============================================================================================
-- SAFE: only adds things; nothing is dropped, deleted or updated.
-- Run ONCE in Supabase: SQL Editor > New query > paste > Run   (safe to run again)
-- Fixes: new players who play but never appear on the Global Leaderboard.
-- Cause: the leaderboard lists a player only if BOTH a `profiles` row and a `player_progress` row exist,
-- and the browser could silently fail to create them (e.g. "Confirm email" on, slow network).
-- ============================================================================================

-- 1) Create the profile + progress rows on the SERVER the moment an account is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.player_progress (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Repair players that already exist without those rows.
insert into public.profiles (id, username)
select u.id, split_part(u.email, '@', 1) from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

insert into public.player_progress (user_id)
select u.id from auth.users u
where not exists (select 1 from public.player_progress p where p.user_id = u.id)
on conflict do nothing;

-- 3) (Not in SQL, to keep this script 100% non-destructive) In Supabase: Authentication > Providers > Email >
--    turn OFF "Confirm email".

-- 4) Leaderboard: LEFT join so a missing profile can never hide a player.
create or replace function get_leaderboard()
returns table (user_id uuid, username text, highest_score int, highest_level int, games_played int)
language sql
security definer
set search_path = public
as $$
  select pr.user_id,
         coalesce(p.username, split_part(u.email, '@', 1)) as username,
         pr.highest_score, pr.highest_level, pr.games_played
  from player_progress pr
  left join profiles p on p.id = pr.user_id
  left join auth.users u on u.id = pr.user_id
  where pr.highest_score > 0
  order by pr.highest_score desc
  limit 100;
$$;
grant execute on function get_leaderboard() to authenticated;