-- ============================================================================
--  Teilnehmernamen bearbeiten — Berechtigungen + sanftes 30-Zeichen-Limit
--  Einmal im Supabase SQL-Editor ausführen. Idempotent.
--
--  WICHTIG: KEIN CHECK-Constraint (würde bei bestehenden langen Namen knallen)
--  und KEIN Massen-Update bestehender Daten. Stattdessen ein Trigger, der
--  Namen NUR beim Schreiben sanft auf 30 Zeichen kappt — wirft nie einen
--  Fehler und lässt vorhandene Zeilen unangetastet (Anzeige kürzt ohnehin per
--  truncateName). Längere Alt-Namen werden erst beim nächsten Bearbeiten kurz.
-- ============================================================================

-- 1) Sanftes Limit: kappt display_name beim Insert/Update auf 30 Zeichen.
create or replace function cap_display_name() returns trigger
language plpgsql as $$
begin
  if new.display_name is not null then
    new.display_name := left(btrim(new.display_name), 30);
  end if;
  return new;
end $$;

drop trigger if exists trg_cap_display_name on public.profiles;
create trigger trg_cap_display_name
  before insert or update on public.profiles
  for each row execute function cap_display_name();

-- 2) Eigener Anzeigename: jeder darf nur den eigenen ändern (is_admin bleibt gesperrt).
drop policy if exists update_own_profile on public.profiles;
create policy update_own_profile on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

-- 3) Admin darf fremde Anzeigenamen ändern.
drop policy if exists admin_update_profiles on public.profiles;
create policy admin_update_profiles on public.profiles for update to authenticated
  using ((select p.is_admin from public.profiles p where p.id = auth.uid()))
  with check ((select p.is_admin from public.profiles p where p.id = auth.uid()));
