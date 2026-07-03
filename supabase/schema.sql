-- ============================================================
-- MEMORA — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. titles
-- Canonical catalogue of movies/TV shows. Shared across all
-- users so the same title isn't duplicated per-user. Users can
-- add new titles (manual entry for now; swap for a TMDB import
-- later without touching user_titles).
-- ------------------------------------------------------------
create table if not exists public.titles (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  type            text not null check (type in ('movie', 'tv')),
  genre           text,
  total_episodes  integer,               -- null for movies / unknown-length shows
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (title, type)
);

comment on table public.titles is 'Canonical movie/TV metadata, shared across users.';

-- ------------------------------------------------------------
-- 1b. Metadata expansion (v2)
-- Adds columns needed for real provider metadata (e.g. TMDB) without
-- touching manually-added rows — all nullable, all backward
-- compatible with the v1 schema. Safe to re-run: every column uses
-- `add column if not exists`.
-- ------------------------------------------------------------
alter table public.titles add column if not exists tmdb_id         integer;
alter table public.titles add column if not exists imdb_id         text;
alter table public.titles add column if not exists poster_url      text;
alter table public.titles add column if not exists backdrop_url    text;
alter table public.titles add column if not exists overview        text;
alter table public.titles add column if not exists release_year    integer;
alter table public.titles add column if not exists runtime         integer;         -- minutes
alter table public.titles add column if not exists popularity      double precision;
alter table public.titles add column if not exists original_title  text;
alter table public.titles add column if not exists language        text;            -- ISO 639-1, e.g. 'en'
alter table public.titles add column if not exists status          text;            -- e.g. 'Released', 'Ended', 'Returning Series'
alter table public.titles add column if not exists vote_average     double precision; -- TMDB's own audience rating (0-10), distinct from a user's personal rating in user_titles

comment on column public.titles.vote_average is 'TMDB''s aggregate audience rating (0-10). Shown on the Title Details page alongside — not instead of — the signed-in user''s own rating.';

comment on column public.titles.tmdb_id is 'The Movie Database id, once a title is matched/imported from TMDB. Null for manual entries.';
comment on column public.titles.popularity is 'Provider-supplied popularity score, used to rank global catalogue search results.';

-- One title per external id, but only enforced when tmdb_id is set —
-- manual entries (tmdb_id null) are unaffected and can still collide
-- on the existing unique(title, type) constraint above.
create unique index if not exists idx_titles_tmdb_id on public.titles (tmdb_id) where tmdb_id is not null;

-- Powers GlobalTitleSearchRepository's ORDER BY popularity DESC.
create index if not exists idx_titles_popularity on public.titles (popularity desc nulls last);

-- ------------------------------------------------------------
-- 2. user_titles
-- One row per (user, title): tracks that user's personal status,
-- rating, notes and episode progress. This is the table your
-- watchlist/watching/watched screens read from.
-- ------------------------------------------------------------
create table if not exists public.user_titles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title_id         uuid not null references public.titles(id) on delete cascade,
  status           text not null check (status in ('watchlist', 'watching', 'watched')),
  rating           smallint check (rating between 0 and 5),
  notes            text,
  current_season   integer default 1,
  current_episode  integer default 0,
  added_at         timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, title_id)
);

comment on table public.user_titles is 'Per-user tracking state for a title: status, rating, notes, episode progress.';

-- keep updated_at fresh on every change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_titles_updated_at on public.user_titles;
create trigger trg_user_titles_updated_at
  before update on public.user_titles
  for each row execute function public.set_updated_at();

-- helpful indexes
create index if not exists idx_user_titles_user_id on public.user_titles (user_id);
create index if not exists idx_user_titles_status on public.user_titles (user_id, status);
create index if not exists idx_titles_type on public.titles (type);

-- ------------------------------------------------------------
-- 3. Row Level Security
-- ------------------------------------------------------------
alter table public.titles enable row level security;
alter table public.user_titles enable row level security;

-- titles: any authenticated user can read the shared catalogue,
-- and can add new entries (e.g. a title that doesn't exist yet).
-- No update/delete from the client — keep the catalogue append-only
-- for now; curation happens server-side later if needed.
create policy "titles are readable by authenticated users"
  on public.titles for select
  to authenticated
  using (true);

create policy "authenticated users can add titles"
  on public.titles for insert
  to authenticated
  with check (auth.uid() = created_by);

-- user_titles: strictly scoped to the owning user.
create policy "users can read their own tracking rows"
  on public.user_titles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert their own tracking rows"
  on public.user_titles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update their own tracking rows"
  on public.user_titles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own tracking rows"
  on public.user_titles for delete
  to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. activity_log
-- Append-only per-user event history powering the Recent Activity
-- feed (Milestone 2). Written by UserLibraryService alongside each
-- mutation (add, status change, rating, removal) — never by the
-- client directly, and logging failures never block or roll back
-- the mutation they describe (see ActivityService.log).
-- ------------------------------------------------------------
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title_id    uuid references public.titles(id) on delete set null,
  title_name  text not null,   -- denormalized snapshot: the feed still reads fine after a title is removed
  action      text not null check (action in ('added', 'status_changed', 'rated', 'removed')),
  detail      jsonb,           -- small structured payload, e.g. {"from":"watchlist","to":"watching"} or {"rating":5}
  created_at  timestamptz not null default now()
);

comment on table public.activity_log is 'Append-only per-user event history powering the Recent Activity feed.';

create index if not exists idx_activity_log_user_created on public.activity_log (user_id, created_at desc);

alter table public.activity_log enable row level security;

create policy "users can read their own activity"
  on public.activity_log for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert their own activity"
  on public.activity_log for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No update/delete policy: the log is intentionally append-only.

-- ------------------------------------------------------------
-- 5. Convenience view (optional)
-- Flattens titles + user_titles for a simpler client-side select.
-- ------------------------------------------------------------
create or replace view public.my_titles as
select
  ut.id,
  ut.user_id,
  ut.status,
  ut.rating,
  ut.notes,
  ut.current_season,
  ut.current_episode,
  ut.added_at,
  ut.updated_at,
  t.id as title_id,
  t.title,
  t.type,
  t.genre,
  t.total_episodes,
  t.poster_url,
  t.backdrop_url,
  t.overview,
  t.release_year,
  t.runtime,
  t.popularity,
  t.original_title,
  t.language,
  t.status as title_status,
  t.vote_average
from public.user_titles ut
join public.titles t on t.id = ut.title_id;

-- Views inherit RLS from underlying tables only when declared
-- security_invoker (Postgres 15+ / Supabase default is fine here).
alter view public.my_titles set (security_invoker = true);
