-- ============================================================================
--  Automatischer Sync via Supabase Cron (pg_cron + pg_net)
--  Im Supabase SQL-Editor ausführen, NACHDEM die Edge Function 'sync' deployt
--  und die Secrets (FOOTBALL_DATA_TOKEN, SYNC_SECRET) gesetzt sind.
--
--  Clever: Der Job tickt alle 10s, ruft die Function aber NUR auf, wenn gerade
--  ein Spiel im Zeitfenster läuft -> [Anpfiff − 30 min , Anpfiff + 180 min].
--  180 min deckt 90 min + Halbzeit + Verlängerung + Elfmeterschießen + Puffer.
--  Außerhalb der Spielzeiten kostet es 0 API-Calls und 0 Function-Aufrufe.
--
--  Vorher <SYNC_SECRET> ersetzen (= Wert aus `supabase secrets set SYNC_SECRET=...`).
--  Die Projekt-URL ist bereits eingetragen.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Hilfsfunktion: läuft gerade (oder gleich) ein Spiel?
create or replace function tippspiel_match_window() returns boolean
language sql stable as $$
  select exists (
    select 1 from public.matches m
    where now() >= m.kickoff - interval '30 minutes'
      and now() <= m.kickoff + interval '180 minutes'
  );
$$;

-- Saubere Neuinstallation
select cron.unschedule('tippspiel-live') where exists (select 1 from cron.job where jobname = 'tippspiel-live');
select cron.unschedule('tippspiel-full') where exists (select 1 from cron.job where jobname = 'tippspiel-full');

-- LIVE: alle 10 s, aber nur im Spiel-Fenster -> 1 API-Call (6/Min < Limit 10/Min)
select cron.schedule(
  'tippspiel-live',
  '10 seconds',
  $$
  select net.http_post(
    url     := 'https://sonlhzrpygddsyfgmwmg.supabase.co/functions/v1/sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <SYNC_SECRET>'),
    body    := jsonb_build_object('action', 'live')
  )
  where tippspiel_match_window();
  $$
);

-- FULL: alle 5 Min, nur im Spiel-Fenster -> Tabellen + Torschützen + Bonus (3 Calls)
select cron.schedule(
  'tippspiel-full',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://sonlhzrpygddsyfgmwmg.supabase.co/functions/v1/sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <SYNC_SECRET>'),
    body    := jsonb_build_object('action', 'full')
  )
  where tippspiel_match_window();
  $$
);

-- ODDS: alle 6 Stunden 1X2-Quoten holen (The Odds API; ~4 Calls/Tag, Free-Limit ~500/Monat)
select cron.unschedule('tippspiel-odds') where exists (select 1 from cron.job where jobname = 'tippspiel-odds');
select cron.schedule(
  'tippspiel-odds',
  '0 */6 * * *',
  $$
  select net.http_post(
    url     := 'https://sonlhzrpygddsyfgmwmg.supabase.co/functions/v1/sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <SYNC_SECRET>'),
    body    := jsonb_build_object('action', 'odds')
  );
  $$
);

-- Status / Logs:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
-- Komplett abschalten:
--   select cron.unschedule('tippspiel-live');
--   select cron.unschedule('tippspiel-full');
