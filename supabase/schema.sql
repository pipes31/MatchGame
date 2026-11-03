-- Global ranking for Gamerz. Run in the Supabase SQL editor (safe to re-run).
--
-- Scores are only written by the submit-score Edge Function, which replays each game
-- from its server-issued seed. Browsers can read the ranking but never write to it.

-- One row per ranked game session, issued by the start-game Edge Function.
create table if not exists public.games (
  id         uuid        primary key default gen_random_uuid(),
  seed       bigint      not null,
  created_at timestamptz not null default now(),
  used_at    timestamptz
);

create index if not exists games_unused_idx
  on public.games (created_at) where used_at is null;

-- RLS on with no policies: only the Edge Functions (service role) can see sessions,
-- so nobody can read seeds of games they didn't start.
alter table public.games enable row level security;
revoke all on public.games from anon, authenticated;

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 12),
  score      integer     not null check (score between 1 and 1000000),
  moves      integer     not null check (moves between 0 and 10000),
  created_at timestamptz not null default now()
);

alter table public.scores
  add column if not exists game_id uuid unique references public.games (id) on delete set null;

create index if not exists scores_score_idx
  on public.scores (score desc, created_at asc);

alter table public.scores enable row level security;

-- Anyone can read the ranking.
drop policy if exists "scores are public" on public.scores;
create policy "scores are public"
  on public.scores for select
  to anon, authenticated
  using (true);

-- Nobody but the service role writes scores.
drop policy if exists "anyone can submit a score" on public.scores;
revoke insert, update, delete on public.scores from anon, authenticated;

-- Scores sent before verification existed can't be trusted; uncomment to clear them.
-- delete from public.scores where game_id is null;
