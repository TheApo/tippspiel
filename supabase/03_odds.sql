-- ============================================================================
--  Quoten (1X2) — Spalten an matches anhängen. Nach schema.sql ausführen.
--  Werte kommen von The Odds API (Dezimalquoten, Durchschnitt der Buchmacher).
-- ============================================================================
alter table matches add column if not exists odd_home    numeric;
alter table matches add column if not exists odd_draw    numeric;
alter table matches add column if not exists odd_away     numeric;
alter table matches add column if not exists odds_updated timestamptz;
