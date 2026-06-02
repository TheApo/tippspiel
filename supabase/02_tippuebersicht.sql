-- ============================================================================
--  Ergänzung für die Tippübersicht (nach schema.sql im SQL-Editor ausführen).
--  Zwei aggregierende Views, die NUR die Existenz eines Tipps zeigen
--  (kein Ergebnis) -> "hat getippt"-Anzeige wie bei kicktipp, auch vor Anpfiff.
--  Views laufen als Owner (security definer) und umgehen damit die Zeilen-RLS,
--  geben aber keine Tipp-Werte preis.
-- ============================================================================

create or replace view v_tip_status as
  select user_id, match_id from tips;

create or replace view v_bonus_status as
  select user_id, count(*)::int as answered from bonus_tips group by user_id;

grant select on v_tip_status, v_bonus_status to authenticated;
