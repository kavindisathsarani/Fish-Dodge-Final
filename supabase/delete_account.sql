-- Lets a logged-in player delete their OWN account. Because profiles, player_progress and
-- game_runs reference auth.users "on delete cascade", all their data is removed too.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
