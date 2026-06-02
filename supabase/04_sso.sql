-- ============================================================================
--  Optional für Microsoft-Login: Anzeigename aus dem MS-Profil übernehmen.
--  Aktualisiert handle_new_user(), sodass full_name / name (von Azure) genutzt
--  werden, bevor auf das E-Mail-Präfix zurückgefallen wird.
--  Nach dem Einrichten des Azure-Providers ausführen.
-- ============================================================================
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare admin text;
begin
  select admin_email into admin from app_settings where id = 1;
  insert into profiles (id, email, display_name, is_admin)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    lower(new.email) = lower(admin)
  )
  on conflict (id) do nothing;
  return new;
end $$;
