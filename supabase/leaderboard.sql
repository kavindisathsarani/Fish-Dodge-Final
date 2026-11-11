-- ============================================================
-- Run this in Supabase: SQL Editor > New query > paste > Run
-- ============================================================

-- Allow authenticated users to read all profiles (needed for global leaderboard)
-- (Skip if the policy already exists)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles' and policyname = 'read all usernames'
  ) then
    execute $p$
      create policy "read all usernames"
        on profiles for select
        using (auth.role() = 'authenticated')
    $p$;
  end if;
end $$;

-- Global leaderboard function
create or replace function get_leaderboard()
returns table (
  user_id  uuid,
  username text,
  highest_score int,
  highest_level int,
  games_played  int
)
language sql
security definer
set search_path = public
as $$
  select
    pr.user_id,
    p.username,
    pr.highest_score,
    pr.highest_level,
    pr.games_played
  from player_progress pr
  join profiles p on p.id = pr.user_id
  where pr.highest_score > 0
  order by pr.highest_score desc
  limit 100;
$$;

-- Grant execute permission to logged-in players
grant execute on function get_leaderboard() to authenticated;

