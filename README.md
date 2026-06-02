# BMS CS Tippspiel — WM 2026

Kicktipp-ähnliches Tippspiel für BMS Corporate Solutions: alle WM-2026-Spiele tippen,
Bonus-Tipps abgeben, WM-Tabellen sehen und in der Gesamtliste klettern.

**Stack:** React 19 + TypeScript + Vite · i18next (DE/EN) · Supabase (Postgres, Auth, RLS, Edge Functions) · football-data.org (Spielplan/Ergebnisse/Tabellen/Torschützen).

---

## 1. Lokal starten

```bash
npm install
# .env mit deinen Supabase-Werten füllen (siehe unten)
npm run dev
```

`.env` (Werte aus Supabase → Project Settings → API):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key>
VITE_ADMIN_EMAIL=dirk.aporius@bms-cs.de
```

## 2. Supabase einrichten

1. **Schema:** `supabase/schema.sql` im SQL-Editor ausführen (Tabellen, RLS, RPCs, Leaderboard-Views, Bonus-Fragen).
2. **Admin:** Wer sich mit `VITE_ADMIN_EMAIL` registriert, wird automatisch Admin.
3. **Daten laden — einfachste Variante (lokal):**
   `.env.local` mit `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_TOKEN` füllen, dann `npm run sync`.
   Während der WM jederzeit erneut ausführen (holt Ergebnisse, wertet alle Tipps).

### Automatischer Live-Sync (alle 10 s) — Edge Function + Cron

Damit Ergebnisse ohne laufenden Rechner aktualisiert werden:

```bash
npx supabase login
npx supabase link --project-ref sonlhzrpygddsyfgmwmg
npx supabase secrets set FOOTBALL_DATA_TOKEN=<token> SYNC_SECRET=<beliebiges_geheimnis> ODDS_API_KEY=<the-odds-api-key>
npx supabase functions deploy sync --no-verify-jwt
```

**Quoten (1X2):** kostenlosen Key auf [the-odds-api.com](https://the-odds-api.com) holen, als `ODDS_API_KEY`
setzen (Secret oben bzw. `.env.local` fürs lokale Skript). Action `odds` (Cron alle 6 h in `cron.sql`)
holt Heim/Unentschieden/Auswärts-Quoten und zeigt die Chancen pro Spiel an. DB: `supabase/03_odds.sql` einspielen.

Dann `supabase/cron.sql` im SQL-Editor ausführen (`<SYNC_SECRET>` ersetzen).
Der Job tickt alle 10 s, ruft die Function aber **nur im Spiel-Fenster** auf
(Anpfiff − 30 min bis Anpfiff + 180 min, deckt Verlängerung + Elfmeterschießen) —
1 API-Call pro Tick = 6/Min, unter dem Limit (10/Min). Außerhalb: 0 Calls.

## Hosting (GitHub Pages, Deploy aus `/docs`)

Lokal bauen (schreibt dank `outDir: 'docs'` direkt nach `docs/`), committen, pushen:

```bash
npm run build
git add docs && git commit -m "build" && git push
```

Einmalig: Repo → *Settings → Pages → Build and deployment → Source: **Deploy from a branch***,
Branch `main`, Ordner **`/docs`**. HashRouter + relative Pfade → läuft unter
`https://<user>.github.io/<repo>/`.

> Die öffentlichen Werte (Supabase-URL + Publishable-Key) werden beim **lokalen** Build aus `.env`
> übernommen und ins Bundle gebacken — es ist **kein** GitHub-Secret/Variable nötig. `.nojekyll`
> liegt in `public/` und landet automatisch in `docs/`. Anleitungen: `SETUP.md`.

## 3. Bedienung

- **Start:** Begrüßung, dein Platz/Punkte, nächste Spiele, Top 3.
- **Tippen:** je Spieltag; Eingabe bis Anpfiff, danach gesperrt; danach Ergebnis + Punkte.
- **Bonus:** Gruppensieger A–L, Weltmeister, 4 Halbfinalisten, Torschützenkönig (bis Anpfiff ST 1).
- **Gesamtliste:** Punkte je Spieltag + Bonus + Gesamt, nach Gesamt sortiert (kicktipp-Stil).
- **WM-Tabellen:** Gruppen A–L, aus den Ergebnissen berechnet.
- **Regeln:** vollständige Punkte-Erklärung.
- **Admin:** „Sync" anstoßen und Ergebnisse manuell korrigieren.

## Wertung (Single Source of Truth)

Die komplette Punktelogik liegt **nur** in `supabase/functions/_shared/scoring.ts`
(getestet via `npm test`) und wird von der Edge Function autoritativ berechnet:

| Fall | Punkte |
|------|:------:|
| Exaktes Ergebnis | 4 |
| Richtige Tordifferenz (bei Sieg) | 3 |
| Richtige Tendenz (Sieger / Remis) | 2 |
| Exaktes Unentschieden | 4 |
| Falsche Tendenz | 0 |
| Bonus je Treffer | 4 |

K.o.: gewertet inkl. Verlängerung; bei Elfmeterschießen erhält der Sieger +1 Tor
(z. B. 1:1 n. V., Elfersieg → gewertet 2:1).

**Spieltage:** Gruppe ST 1–6 (je 8 Spiele), ST 7–10 (je 6, letzter zeitgleicher Gruppenspieltag),
dann je 1 ST pro K.o.-Runde (Sechzehntel-, Achtel-, Viertel-, Halbfinale, Finaltag = Finale + Platz 3).

## Befehle

```bash
npm run dev        # Dev-Server
npm run build      # Production-Build
npm test           # Wertungs-Tests (Vitest)
npm run typecheck  # TypeScript
npm run lint       # ESLint
```

## Roadmap

- Phase 2: Microsoft-Login (Entra ID) über den Supabase-Azure-Provider statt E-Mail/Passwort.
