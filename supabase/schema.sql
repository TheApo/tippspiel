-- ============================================================================
--  BMS CS Tippspiel — Supabase Schema (Postgres)
--  Im Supabase SQL-Editor ausführen (einmalig). Idempotent gehalten.
--
--  Designprinzip (DRY/KISS):
--   * KEINE Punkte-Logik in SQL — die Wertung lebt ausschließlich in
--     supabase/functions/_shared/scoring.ts und wird von der Edge-Function
--     'sync' berechnet (schreibt tips.points / bonus_tips.points mit Service-Role).
--   * Schreiben von Tipps NUR über RPCs mit serverseitiger Deadline-Prüfung.
--   * Lesen über RLS; aggregierte Leaderboard-Views für alle sichtbar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Konfiguration (1 Zeile)
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  id            int primary key default 1 check (id = 1),
  admin_email   text not null default 'dirk.aporius@bms-cs.de',
  bonus_deadline timestamptz,                 -- = Anpfiff Spieltag 1 (Sync setzt das)
  season        text not null default 'WC-2026',
  constraint one_row check (id = 1)
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profile (1:1 zu auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text not null,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Beim Registrieren automatisch Profil anlegen, Admin anhand E-Mail markieren.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare admin text;
begin
  select admin_email into admin from app_settings where id = 1;
  insert into profiles (id, email, display_name, is_admin)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    lower(new.email) = lower(admin)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------
create table if not exists teams (
  id           text primary key,            -- football-data team id (als text)
  name         text not null,
  short_name   text,
  tla          text,                        -- 3-Letter-Code (GER, BRA, ...)
  iso2         text,                        -- für Flaggen-CDN (de, br, ...)
  crest_url    text,
  group_letter text                         -- 'A'..'L'
);

-- ---------------------------------------------------------------------------
-- Spiele
-- ---------------------------------------------------------------------------
create table if not exists matches (
  id           bigint primary key,          -- football-data match id
  matchday     int not null,                -- unser Tipp-Spieltag (1..N)
  stage        text not null,               -- GROUP | LAST_32 | LAST_16 | QUARTER_FINALS | SEMI_FINALS | THIRD_PLACE | FINAL
  group_letter text,
  kickoff      timestamptz not null,
  status       text not null default 'SCHEDULED', -- SCHEDULED | LIVE | FINISHED
  home_team_id text references teams (id),
  away_team_id text references teams (id),
  -- Roh-Ergebnis (Stand nach reg. Spielzeit bzw. Verlängerung):
  full_home    int,
  full_away    int,
  duration     text default 'REGULAR',      -- REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
  winner       text,                        -- HOME_TEAM | AWAY_TEAM | DRAW
  -- gewertetes Ergebnis (inkl. Elfmeter-Konvention, von 'sync' gesetzt):
  eff_home     int,
  eff_away     int
);
create index if not exists matches_matchday_idx on matches (matchday, kickoff);

-- ---------------------------------------------------------------------------
-- Bonus-Fragen (statisch) + Antworten (vom Sync gesetzt)
-- ---------------------------------------------------------------------------
create table if not exists bonus_questions (
  id           text primary key,            -- 'group_A' ... 'group_L', 'champion', 'semifinalists', 'top_scorer'
  category     text not null,               -- group_winner | champion | semifinalists | top_scorer
  kind         text not null,               -- single | set
  group_letter text,
  sort         int not null default 0,
  answer       text[]                       -- korrekte Antwort(en); single = 1 Element
);

-- Seed: 12 Gruppensieger + 3 Sonderfragen
insert into bonus_questions (id, category, kind, group_letter, sort) values
  ('group_A','group_winner','single','A',1),
  ('group_B','group_winner','single','B',2),
  ('group_C','group_winner','single','C',3),
  ('group_D','group_winner','single','D',4),
  ('group_E','group_winner','single','E',5),
  ('group_F','group_winner','single','F',6),
  ('group_G','group_winner','single','G',7),
  ('group_H','group_winner','single','H',8),
  ('group_I','group_winner','single','I',9),
  ('group_J','group_winner','single','J',10),
  ('group_K','group_winner','single','K',11),
  ('group_L','group_winner','single','L',12),
  ('champion','champion','single',null,20),
  ('semifinalists','semifinalists','set',null,21),
  ('top_scorer','top_scorer','single',null,22)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Tipps
-- ---------------------------------------------------------------------------
create table if not exists tips (
  user_id    uuid not null references profiles (id) on delete cascade,
  match_id   bigint not null references matches (id) on delete cascade,
  home       int not null check (home >= 0),
  away       int not null check (away >= 0),
  points     int,                           -- von 'sync' gesetzt; null = noch nicht gewertet
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

create table if not exists bonus_tips (
  user_id     uuid not null references profiles (id) on delete cascade,
  question_id text not null references bonus_questions (id) on delete cascade,
  picks       text[] not null,              -- single = 1 Element, set = bis zu 4
  points      int,
  updated_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- ============================================================================
--  Row Level Security
-- ============================================================================
alter table profiles        enable row level security;
alter table teams           enable row level security;
alter table matches         enable row level security;
alter table bonus_questions enable row level security;
alter table tips            enable row level security;
alter table bonus_tips      enable row level security;
alter table app_settings    enable row level security;

-- Stammdaten: für alle Eingeloggten lesbar
drop policy if exists read_profiles on profiles;
create policy read_profiles on profiles for select to authenticated using (true);
drop policy if exists read_teams on teams;
create policy read_teams on teams for select to authenticated using (true);
drop policy if exists read_matches on matches;
create policy read_matches on matches for select to authenticated using (true);
drop policy if exists read_bonusq on bonus_questions;
create policy read_bonusq on bonus_questions for select to authenticated using (true);
drop policy if exists read_settings on app_settings;
create policy read_settings on app_settings for select to authenticated using (true);

-- Eigenen Anzeigenamen ändern dürfen
drop policy if exists update_own_profile on profiles;
create policy update_own_profile on profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id and is_admin = (select is_admin from profiles p where p.id = auth.uid()));

-- Tipps: eigene immer lesbar; fremde erst ab Anpfiff des Spiels
drop policy if exists read_own_tips on tips;
create policy read_own_tips on tips for select to authenticated using (auth.uid() = user_id);
drop policy if exists read_tips_after_kickoff on tips;
create policy read_tips_after_kickoff on tips for select to authenticated using (
  exists (select 1 from matches m where m.id = tips.match_id and m.kickoff <= now())
);

-- Bonus-Tipps: eigene immer; fremde erst nach Bonus-Deadline (Anpfiff Spieltag 1)
drop policy if exists read_own_bonus on bonus_tips;
create policy read_own_bonus on bonus_tips for select to authenticated using (auth.uid() = user_id);
drop policy if exists read_bonus_after_deadline on bonus_tips;
create policy read_bonus_after_deadline on bonus_tips for select to authenticated using (
  coalesce((select bonus_deadline from app_settings where id = 1), 'infinity'::timestamptz) <= now()
);

-- WICHTIG: kein direktes INSERT/UPDATE auf tips/bonus_tips für Clients.
-- Schreiben ausschließlich über die RPCs unten (Deadline-Prüfung serverseitig).

-- ============================================================================
--  Schreib-RPCs (SECURITY DEFINER) mit Deadline-Prüfung
-- ============================================================================
create or replace function upsert_tip(p_match_id bigint, p_home int, p_away int)
returns void language plpgsql security definer set search_path = public as $$
declare ko timestamptz;
begin
  if p_home < 0 or p_away < 0 then raise exception 'Negative Tore unzulässig'; end if;
  select kickoff into ko from matches where id = p_match_id;
  if ko is null then raise exception 'Spiel nicht gefunden'; end if;
  if ko <= now() then raise exception 'Tippfrist abgelaufen'; end if;

  insert into tips (user_id, match_id, home, away, points, updated_at)
  values (auth.uid(), p_match_id, p_home, p_away, null, now())
  on conflict (user_id, match_id)
  do update set home = excluded.home, away = excluded.away, points = null, updated_at = now();
end $$;

create or replace function upsert_bonus_tip(p_question_id text, p_picks text[])
returns void language plpgsql security definer set search_path = public as $$
declare dl timestamptz;
begin
  select bonus_deadline into dl from app_settings where id = 1;
  if dl is not null and dl <= now() then raise exception 'Bonus-Tippfrist abgelaufen'; end if;

  insert into bonus_tips (user_id, question_id, picks, points, updated_at)
  values (auth.uid(), p_question_id, p_picks, null, now())
  on conflict (user_id, question_id)
  do update set picks = excluded.picks, points = null, updated_at = now();
end $$;

grant execute on function upsert_tip(bigint, int, int) to authenticated;
grant execute on function upsert_bonus_tip(text, text[]) to authenticated;

-- ============================================================================
--  Leaderboard-Views (aggregiert, für alle Eingeloggten sichtbar)
-- ============================================================================
-- Punkte je Spieler & Spieltag
create or replace view v_matchday_points as
select t.user_id, m.matchday, sum(coalesce(t.points, 0))::int as points
from tips t join matches m on m.id = t.match_id
group by t.user_id, m.matchday;

-- Bonuspunkte je Spieler
create or replace view v_bonus_points as
select user_id, sum(coalesce(points, 0))::int as points
from bonus_tips group by user_id;

-- Gesamtwertung inkl. Tie-Break (mehr exakte 4-Punkte-Tipps zuerst)
create or replace view v_user_totals as
select
  p.id            as user_id,
  p.display_name,
  coalesce(mp.match_points, 0)               as match_points,
  coalesce(bp.points, 0)                     as bonus_points,
  coalesce(mp.match_points, 0) + coalesce(bp.points, 0) as total,
  coalesce(mp.exact_hits, 0)                 as exact_hits
from profiles p
left join (
  select user_id, sum(coalesce(points,0))::int as match_points,
         count(*) filter (where points = 4)   as exact_hits
  from tips group by user_id
) mp on mp.user_id = p.id
left join v_bonus_points bp on bp.user_id = p.id;

grant select on v_matchday_points, v_bonus_points, v_user_totals to authenticated;
