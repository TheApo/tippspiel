/**
 * Lokales Sync-Skript: holt die WM-2026-Daten von football-data.org und
 * schreibt sie direkt in Supabase (mit Service-Role, umgeht RLS).
 *
 * Start:  npm run sync
 * Vorher: .env.local mit SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *         FOOTBALL_DATA_TOKEN befüllen (siehe .env.local).
 *
 * Nutzt denselben Kern wie die Edge Function (DRY).
 */
import { createClient } from '@supabase/supabase-js'
import { runFullSync, syncOdds, type FdFetch, type OddsFetch } from '../supabase/functions/_shared/sync-core.ts'

const url = process.env.SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const token = process.env.FOOTBALL_DATA_TOKEN

if (!url || !service || !token) {
  console.error('Fehlend: bitte SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY und FOOTBALL_DATA_TOKEN in .env.local setzen.')
  process.exit(1)
}

const db = createClient(url, service, { auth: { persistSession: false } })
const fd: FdFetch = async (path) => {
  const r = await fetch(`https://api.football-data.org/v4${path}`, { headers: { 'X-Auth-Token': token } })
  if (!r.ok) throw new Error(`football-data ${path} -> ${r.status} ${await r.text()}`)
  return r.json()
}

console.log('Synchronisiere WM 2026 …')
const res = await runFullSync(db, fd)
console.log('Fertig:', res)

const oddsKey = process.env.ODDS_API_KEY
if (oddsKey) {
  try {
    const oddsFetch: OddsFetch = async () => {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${oddsKey}`)
      if (!r.ok) throw new Error(`odds-api -> ${r.status} ${await r.text()}`)
      return r.json()
    }
    console.log('Hole Quoten …')
    console.log('Quoten:', await syncOdds(db, oddsFetch))
  } catch (e) {
    console.warn('Quoten übersprungen (Abruf fehlgeschlagen — z. B. von Firmennetz blockiert):', e instanceof Error ? e.message : e)
  }
} else {
  console.log('Quoten übersprungen (ODDS_API_KEY nicht gesetzt).')
}
