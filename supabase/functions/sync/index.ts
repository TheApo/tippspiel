// Supabase Edge Function "sync" (dünner Wrapper um ../_shared/sync-core.ts)
//
// actions:
//   'live'       -> 1 API-Call (nur Spiele/Ergebnisse) — für 10s-Cron-Polling
//   'sync'/'full'-> 3 API-Calls (+ Tabellen + Torschützen) — Bonus auflösen
//   'set_result' -> Admin setzt ein Ergebnis manuell
//
// Zugriff: entweder eingeloggter Admin (User-JWT) ODER Cron mit Header
//   Authorization: Bearer <SYNC_SECRET>   (Secret = Function-Env SYNC_SECRET)
//
// Deploy:  npx supabase functions deploy sync --no-verify-jwt
// Secrets: npx supabase secrets set FOOTBALL_DATA_TOKEN=... SYNC_SECRET=...

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  syncMatchesOnly, runFullSync, applyManualResult, syncOdds,
  type ManualResult, type FdFetch, type OddsFetch,
} from '../_shared/sync-core.ts'

const FD = 'https://api.football-data.org/v4'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const syncSecret = Deno.env.get('SYNC_SECRET')

    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const admin = createClient(url, service)

    // Zugriff prüfen: Cron-Secret ODER eingeloggter Admin
    let allowed = Boolean(syncSecret && bearer === syncSecret)
    let isAdminUser = false
    if (!allowed) {
      const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${bearer}` } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (user) {
        const { data: prof } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
        isAdminUser = Boolean(prof?.is_admin)
        allowed = isAdminUser
      }
    }
    if (!allowed) return json({ error: 'forbidden' }, 403)

    const body = await req.json().catch(() => ({}))

    if (body.action === 'delete_user') {
      if (!isAdminUser) return json({ error: 'forbidden' }, 403)
      const targetId = String(body.user_id ?? '')
      if (!targetId) return json({ error: 'user_id fehlt' }, 400)
      // Löscht den Auth-User -> Kaskade auf profiles -> tips/bonus_tips
      const { error } = await admin.auth.admin.deleteUser(targetId)
      if (error) throw error
      return json({ ok: true, deleted: targetId })
    }

    if (body.action === 'set_result') {
      await applyManualResult(admin, body as ManualResult)
      return json({ ok: true, recomputed: true })
    }

    if (body.action === 'odds') {
      const oddsKey = Deno.env.get('ODDS_API_KEY')
      if (!oddsKey) return json({ error: 'ODDS_API_KEY nicht gesetzt' }, 500)
      const oddsFetch: OddsFetch = async () => {
        const r = await fetch(`https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${oddsKey}`)
        if (!r.ok) throw new Error(`odds-api -> ${r.status} ${await r.text()}`)
        return r.json()
      }
      const res = await syncOdds(admin, oddsFetch)
      return json({ ok: true, mode: 'odds', ...res })
    }

    const token = Deno.env.get('FOOTBALL_DATA_TOKEN')
    if (!token) return json({ error: 'FOOTBALL_DATA_TOKEN nicht gesetzt' }, 500)
    const fd: FdFetch = async (path) => {
      const r = await fetch(`${FD}${path}`, { headers: { 'X-Auth-Token': token } })
      if (!r.ok) throw new Error(`football-data ${path} -> ${r.status} ${await r.text()}`)
      return r.json()
    }

    const res = body.action === 'live'
      ? await syncMatchesOnly(admin, fd)
      : await runFullSync(admin, fd)
    return json({ ok: true, mode: body.action ?? 'full', ...res })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
