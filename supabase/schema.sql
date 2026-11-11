-- Run this once in Supabase: SQL Editor > New query > paste > Run
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null,
  created_at timestamptz default now()
);
create unique index profiles_username_key on profiles (lower(username));

create table player_progress (
  user_id uuid primary key references auth.users on delete cascade,
  current_level int not null default 1,
  highest_level int not null default 0,
  highest_score int not null default 0,
  games_played int not null default 0,
  updated_at timestamptz default now()
);

create table game_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  level_reached int not null,
  score int not null,
  played_at timestamptz default now()
);

alter table profiles enable row level security;
alter table player_progress enable row level security;
alter table game_runs enable row level security;

-- Row Level Security: a player can only touch their own rows
create policy "own profile"  on profiles        for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own progress" on player_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own runs"     on game_runs       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
