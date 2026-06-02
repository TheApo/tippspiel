# Setup-Anleitungen

## A) Cron-Job aktivieren (automatischer Sync)

> Ziel: Ergebnisse/Quoten werden serverseitig automatisch geholt — ohne laufenden Rechner.
> Voraussetzung: einmalig die Edge Function deployen, dann das Cron-SQL ausführen.

**1. Terminal im Projektordner öffnen** und bei Supabase anmelden (öffnet den Browser):
```bash
npx supabase login
```

**2. Projekt verknüpfen:**
```bash
npx supabase link --project-ref sonlhzrpygddsyfgmwmg
```
> Falls nach dem Datenbank-Passwort gefragt wird: aus *Dashboard → Project Settings → Database*
> (oder dort zurücksetzen). Zum reinen Function-Deploy kann man die Abfrage meist mit Enter überspringen.

**3. Secrets setzen** (`SYNC_SECRET` ist ein von dir frei gewähltes Geheimnis — merken!):
```bash
npx supabase secrets set FOOTBALL_DATA_TOKEN=6fc1d9d4bde5404bbaee41455d46efe5 SYNC_SECRET=DEIN_GEHEIMNIS ODDS_API_KEY=DEIN_ODDS_KEY
```
> `ODDS_API_KEY` weglassen, falls du noch keinen hast.

**4. Edge Function deployen:**
```bash
npx supabase functions deploy sync --no-verify-jwt
```

**5. Cron-SQL ausführen:** in *Supabase → SQL Editor* den Inhalt von `supabase/cron.sql` einfügen,
**vorher** jedes `<SYNC_SECRET>` durch denselben Wert aus Schritt 3 ersetzen → **Run**.
> Falls `create extension` meckert: *Dashboard → Database → Extensions* → `pg_cron` und `pg_net` aktivieren, dann erneut.

**6. Prüfen:**
```sql
select jobname, schedule, active from cron.job;
select jobname, status, start_time from cron.job_run_details order by start_time desc limit 10;
```
Die Live-Abfrage feuert nur **im Spiel-Fenster** (Anpfiff −30 min bis +180 min). Außerhalb: 0 Aufrufe.

> Sobald die Function deployt ist, funktionieren auch die Admin-Buttons **„Sync"** und **„Entfernen"**.
> Komplett abschalten: `select cron.unschedule('tippspiel-live');` (analog `-full`, `-odds`).

---

## B) Microsoft-Login (Entra ID / Azure AD)

> Du brauchst aus einer **App-Registrierung** im BMS-CS-Tenant drei Werte:
> **Application (client) ID**, **Directory (tenant) ID** und ein **Client Secret (Value)**.

**Im Azure-/Entra-Portal** (entra.microsoft.com → *Identität → Anwendungen → App-Registrierungen*):

1. **Neue Registrierung**
   - Name: `BMS CS Tippspiel`
   - Kontotypen: **Nur Konten in diesem Organisationsverzeichnis (BMS CS – Einzelmandant)** → nur BMS-CS-Mitarbeiter.
   - Redirect-URI: Plattform **Web**, URL =
     `https://sonlhzrpygddsyfgmwmg.supabase.co/auth/v1/callback`
   - Registrieren.
2. Auf **Übersicht**: **Application (client) ID** und **Directory (tenant) ID** kopieren.
3. **Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel** → den **Wert** (Value) sofort kopieren
   (wird nur einmal angezeigt). Das ist das **Client Secret**.

**In Supabase** (*Dashboard → Authentication → Providers → Azure*):

4. Azure aktivieren und eintragen:
   - **Client ID** = Application (client) ID
   - **Secret** = Client-Secret-Value
   - **Azure Tenant URL** = `https://login.microsoftonline.com/DEINE_TENANT_ID` (beschränkt auf BMS CS)
   - Speichern. Die angezeigte **Callback URL** muss der Redirect-URI aus Schritt 1 entsprechen.
5. *Authentication → URL Configuration*:
   - **Site URL** = deine App-Adresse (z. B. GitHub-Pages-URL; für lokal `http://localhost:5173`)
   - **Redirect URLs**: deine App-URLs hinzufügen (localhost + Pages), damit der Rücksprung erlaubt ist.

**Optional:** `supabase/04_sso.sql` ausführen — sorgt dafür, dass der Anzeigename aus dem
Microsoft-Profil (`full_name`/`name`) übernommen wird statt nur des E-Mail-Präfixes.

Danach funktioniert der Button **„Mit Microsoft anmelden"** auf der Login-Seite.

---

## C) Quoten (1X2) befüllen

Quelle: **The Odds API** (kostenloser Key auf [the-odds-api.com](https://the-odds-api.com), ~500 Anfragen/Monat).
Vorbereitung einmalig: im SQL-Editor **`supabase/03_odds.sql`** ausführen (Quoten-Spalten).

> ⚠️ **Firmennetz blockt evtl. die Wett-Domain** (`api.the-odds-api.com`, Kategorie „Gambling").
> Erkennbar an `SSL/ECONNRESET`. Zwei Wege, die das umgehen:

**Weg 1 — serverseitig (empfohlen, klappt aus jedem Netz):**
1. Edge Function deployen (Teil A) und `ODDS_API_KEY` als Secret setzen:
   `npx supabase secrets set ODDS_API_KEY=DEIN_KEY`
2. Quoten holen — entweder automatisch per Cron-Job `tippspiel-odds` (alle 6 h, in `cron.sql`),
   oder manuell im **Admin-Bereich → „Quoten aktualisieren"**.
   Supabase ruft The Odds API von seinen Servern ab (nicht über dein Netz).

**Weg 2 — lokal von zu Hause (privates Netz):**
1. `ODDS_API_KEY` steht in `.env.local`.
2. `npm run sync` ausführen — zieht Spiele **und** Quoten. (Schlägt der Quoten-Abruf fehl,
   läuft der Rest trotzdem durch; es kommt nur eine Warnung.)

Danach erscheint pro Spiel ein **1 · X · 2-Chancenbalken** auf der Tipp-Seite.
K.o.-Quoten gibt es erst, wenn die Teams feststehen; Gruppen-Quoten näher am Anpfiff.
