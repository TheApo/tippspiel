-- ============================================================================
--  Gruppen-Feature: Gruppen, Mitgliedschaften, Beitritts-Workflow, Wertungs-Views
--  Einmal im Supabase SQL-Editor ausführen. Idempotent.
--
--  Wertung (wie besprochen):
--    Spielpunkte  = je Spiel der Ø der aktiven Mitglieder, die getippt haben,
--                   aufsummiert über alle Spiele.
--    Bonuspunkte  = je Bonusfrage der Ø der Mitglieder, die geantwortet haben,
--                   aufsummiert.
--    Gesamt       = Spielpunkte + Bonuspunkte.
--  Eine Gruppe zählt in den Auswertungen erst ab 2 aktiven Mitgliedern (Frontend).
--
--  Schreiben NUR über die SECURITY-DEFINER-RPCs (wie upsert_tip). Die Views
--  laufen mit Owner-Rechten und umgehen RLS wie v_user_totals (zeigen Aggregate).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  captain_id  uuid not null references profiles (id) on delete cascade,
  join_mode   text not null default 'apply' check (join_mode in ('open', 'apply')),
  created_at  timestamptz not null default now()
);

create table if not exists group_members (
  group_id   uuid not null references groups (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  status     text not null default 'active' check (status in ('active', 'pending')),
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on group_members (user_id);

-- ---------------------------------------------------------------------------
-- RLS (Lesen; Schreiben läuft über RPCs)
-- ---------------------------------------------------------------------------
alter table groups        enable row level security;
alter table group_members enable row level security;

drop policy if exists read_groups on groups;
create policy read_groups on groups for select to authenticated using (true);

-- Aktive Mitgliedschaften für alle sichtbar; eigene (auch pending) immer;
-- pending zusätzlich für den Captain der jeweiligen Gruppe.
drop policy if exists read_group_members on group_members;
create policy read_group_members on group_members for select to authenticated using (
  status = 'active'
  or user_id = auth.uid()
  or auth.uid() = (select g.captain_id from groups g where g.id = group_id)
);

-- ---------------------------------------------------------------------------
-- Schreib-RPCs (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function create_group(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; nm text;
begin
  nm := left(btrim(coalesce(p_name, '')), 30);
  if nm = '' then raise exception 'Gruppenname fehlt'; end if;
  insert into groups (name, captain_id) values (nm, auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id, status) values (gid, auth.uid(), 'active');
  return gid;
end $$;

-- Beitreten/Bewerben: offene Gruppe -> sofort aktiv, sonst pending.
create or replace function join_group(p_group_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare mode text; st text;
begin
  select join_mode into mode from groups where id = p_group_id;
  if mode is null then raise exception 'Gruppe nicht gefunden'; end if;
  st := case when mode = 'open' then 'active' else 'pending' end;
  insert into group_members (group_id, user_id, status)
  values (p_group_id, auth.uid(), st)
  on conflict (group_id, user_id) do nothing;
  return st;
end $$;

-- Austreten / Bewerbung zurückziehen (Captain kann nicht austreten).
create or replace function leave_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = (select captain_id from groups where id = p_group_id) then
    raise exception 'Captain kann die Gruppe nicht verlassen (erst löschen)';
  end if;
  delete from group_members where group_id = p_group_id and user_id = auth.uid();
end $$;

-- Name + Beitrittsmodus ändern (nur Captain).
create or replace function set_group(p_group_id uuid, p_name text, p_join_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if auth.uid() <> (select captain_id from groups where id = p_group_id) then
    raise exception 'Nur der Captain darf das'; end if;
  if p_join_mode not in ('open', 'apply') then raise exception 'Ungültiger Modus'; end if;
  nm := left(btrim(coalesce(p_name, '')), 30);
  if nm = '' then raise exception 'Gruppenname fehlt'; end if;
  update groups set name = nm, join_mode = p_join_mode where id = p_group_id;
end $$;

-- Bewerber bestätigen (pending -> active), nur Captain.
create or replace function approve_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() <> (select captain_id from groups where id = p_group_id) then
    raise exception 'Nur der Captain darf das'; end if;
  update group_members set status = 'active'
    where group_id = p_group_id and user_id = p_user_id;
end $$;

-- Mitglied/Bewerber entfernen bzw. ablehnen (nur Captain; Captain nicht entfernbar).
create or replace function remove_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() <> (select captain_id from groups where id = p_group_id) then
    raise exception 'Nur der Captain darf das'; end if;
  if p_user_id = (select captain_id from groups where id = p_group_id) then
    raise exception 'Captain kann nicht entfernt werden'; end if;
  delete from group_members where group_id = p_group_id and user_id = p_user_id;
end $$;

-- Gruppe löschen (nur Captain) -> Mitglieder kaskadieren.
create or replace function delete_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() <> (select captain_id from groups where id = p_group_id) then
    raise exception 'Nur der Captain darf das'; end if;
  delete from groups where id = p_group_id;
end $$;

grant execute on function create_group(text)            to authenticated;
grant execute on function join_group(uuid)              to authenticated;
grant execute on function leave_group(uuid)             to authenticated;
grant execute on function set_group(uuid, text, text)   to authenticated;
grant execute on function approve_member(uuid, uuid)    to authenticated;
grant execute on function remove_member(uuid, uuid)     to authenticated;
grant execute on function delete_group(uuid)            to authenticated;

-- ---------------------------------------------------------------------------
-- Wertungs-Views (Owner-Rechte -> umgehen RLS wie v_user_totals)
-- ---------------------------------------------------------------------------
-- Ø-Punkte je Gruppe & Spiel (nur gewertete Tipps aktiver Mitglieder).
create or replace view v_group_match_points as
select gm.group_id, t.match_id, avg(t.points)::numeric(6,2) as avg_points
from group_members gm
join tips t on t.user_id = gm.user_id
where gm.status = 'active' and t.points is not null
group by gm.group_id, t.match_id;

-- Σ je Spieltag.
create or replace view v_group_matchday_points as
select gmp.group_id, m.matchday, sum(gmp.avg_points)::numeric(8,2) as points
from v_group_match_points gmp
join matches m on m.id = gmp.match_id
group by gmp.group_id, m.matchday;

-- Bonus: Σ über Bonusfragen des Ø der antwortenden aktiven Mitglieder.
create or replace view v_group_bonus_points as
select group_id, sum(avg_q)::numeric(8,2) as points
from (
  select gm.group_id, bt.question_id, avg(bt.points) as avg_q
  from group_members gm
  join bonus_tips bt on bt.user_id = gm.user_id
  where gm.status = 'active' and bt.points is not null
  group by gm.group_id, bt.question_id
) s
group by group_id;

-- Gesamtwertung je Gruppe (inkl. Mitgliederzahl für die "ab 2"-Regel).
create or replace view v_group_totals as
select
  g.id          as group_id,
  g.name,
  g.captain_id,
  g.join_mode,
  (select count(*) from group_members gm where gm.group_id = g.id and gm.status = 'active')::int as member_count,
  coalesce(mp.match_points, 0)::numeric(8,2)                       as match_points,
  coalesce(bp.points, 0)::numeric(8,2)                            as bonus_points,
  (coalesce(mp.match_points, 0) + coalesce(bp.points, 0))::numeric(8,2) as total
from groups g
left join (
  select group_id, sum(points)::numeric(8,2) as match_points
  from v_group_matchday_points group by group_id
) mp on mp.group_id = g.id
left join v_group_bonus_points bp on bp.group_id = g.id;

grant select on v_group_match_points, v_group_matchday_points, v_group_bonus_points, v_group_totals to authenticated;
