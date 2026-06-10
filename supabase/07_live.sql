-- Live-Zwischenstand laufender Spiele.
-- Einmal im Supabase SQL-Editor ausführen (idempotent).
--
-- live_home/live_away halten den aktuellen Spielstand, solange status = 'LIVE'.
-- Bewusst getrennt von full_home/full_away (= gewertetes Endergebnis), damit die
-- Punktevergabe erst bei Abpfiff (FINISHED) greift. Der 10-Sekunden-Live-Sync
-- (Edge Function 'sync', action 'live') füllt sie; bei SCHEDULED/FINISHED -> null.

alter table matches add column if not exists live_home int;
alter table matches add column if not exists live_away int;
