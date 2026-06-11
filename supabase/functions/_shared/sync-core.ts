/**
 * Sync-Kernlogik — geteilt von der Edge Function (Deno) UND dem lokalen
 * Skript (Node, scripts/sync.ts). Single Source of Truth für den Datenabgleich.
 *
 * Zwei Modi (Schonung des football-data-Limits von 10 Calls/Min):
 *   syncMatchesOnly() : 1 API-Call (nur Spiele/Ergebnisse) -> für 10s-Live-Polling
 *   runFullSync()     : 3 API-Calls (+ Tabellen + Torschützen) -> Bonus auflösen
 *
 * Bewusst frei von Supabase-Imports: DB-Client `db` und `fdFetch` werden
 * injiziert, damit derselbe Code in Deno und Node läuft.
 */
import {
  effectiveGoals, scoreMatch, scoreBonusSingle, scoreBonusSet,
  type Goals, type MatchDuration, type Winner,
} from './scoring.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any
export type FdFetch = (path: string) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
export type OddsFetch = () => Promise<any[]> // eslint-disable-line @typescript-eslint/no-explicit-any

export const COMP = 'WC'

const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: 'GROUP', LAST_32: 'LAST_32', LAST_16: 'LAST_16',
  QUARTER_FINALS: 'QUARTER_FINALS', SEMI_FINALS: 'SEMI_FINALS',
  THIRD_PLACE: 'THIRD_PLACE', FINAL: 'FINAL',
}
const KO_RANK: Record<string, number> = {
  LAST_32: 1, LAST_16: 2, QUARTER_FINALS: 3, SEMI_FINALS: 4, THIRD_PLACE: 5, FINAL: 5,
}
function mapStatus(s: string): string {
  if (s === 'FINISHED' || s === 'AWARDED') return 'FINISHED'
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'LIVE'
  return 'SCHEDULED'
}

// football-data liefert unter Last zeitweise veraltete Antworten (stale Cache):
// Ein laufendes Spiel kommt dann wieder als TIMED zurück und würde den
// Live-Status alle 10 s löschen. Daher gilt: Ein Spiel, das laut Anstoßzeit
// laufen müsste, fällt nie auf SCHEDULED zurück (Fenster deckt Verlängerung +
// Elfmeterschießen; danach greift wieder der API-Status).
const LIVE_GRACE_MS = 185 * 60_000
function groupLetter(g: string | null): string | null {
  if (!g) return null
  const m = g.match(/([A-L])\s*$/i)
  return m ? m[1].toUpperCase() : null
}

// Teamnamen normalisieren (Diakritika/Sonderzeichen weg) + Alias auf eine
// kanonische Form, damit football-data und The Odds API zusammenpassen.
const NAME_ALIAS: Record<string, string> = {
  korearepublic: 'southkorea', koreadpr: 'northkorea', dprkorea: 'northkorea',
  iriran: 'iran', chinapr: 'china', usa: 'unitedstates', unitedstatesofamerica: 'unitedstates',
  cotedivoire: 'ivorycoast', bosniaandherzegovina: 'bosniaherzegovina',
  czechia: 'czechrepublic', turkiye: 'turkey',
  // Kap Verde: football-data = "Cape Verde Islands", Odds API = "Cabo Verde"/"Cape Verde"
  capeverde: 'caboverde', capeverdeislands: 'caboverde',
  // DR Kongo: football-data = "Congo DR", Odds API = "DR Congo"/"Democratic Republic of Congo"
  congodr: 'drcongo', democraticrepublicofcongo: 'drcongo', democraticrepublicofthecongo: 'drcongo',
}
function normName(s: string | null | undefined): string {
  const n = (s ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
  return NAME_ALIAS[n] ?? n
}

interface FdMatch {
  id: number; utcDate: string; status: string; matchday: number | null; stage: string
  group: string | null
  homeTeam: { id: number | null; name: string | null; shortName: string | null; tla: string | null; crest: string | null }
  awayTeam: { id: number | null; name: string | null; shortName: string | null; tla: string | null; crest: string | null }
  score: { winner: string | null; duration: string; fullTime: { home: number | null; away: number | null } }
}

export interface SyncResult { teams: number; matches: number; live?: string[] }

/** 1 API-Call: nur Spiele/Ergebnisse synchronisieren + Tipps werten. */
export async function syncMatchesOnly(db: Db, fdFetch: FdFetch): Promise<SyncResult> {
  const res = await fdFetch(`/competitions/${COMP}/matches`)
  const fdMatches: FdMatch[] = res.matches ?? []
  const out = await upsertMatches(db, fdMatches)
  await recomputeTips(db)
  return out
}

/** 3 API-Calls: Spiele + Tabellen + Torschützen -> Bonus auflösen + alles werten. */
export async function runFullSync(db: Db, fdFetch: FdFetch): Promise<SyncResult> {
  const [matchesRes, standingsRes, scorersRes] = await Promise.all([
    fdFetch(`/competitions/${COMP}/matches`),
    fdFetch(`/competitions/${COMP}/standings`).catch(() => ({ standings: [] })),
    fdFetch(`/competitions/${COMP}/scorers?limit=1`).catch(() => ({ scorers: [] })),
  ])
  const fdMatches: FdMatch[] = matchesRes.matches ?? []
  const out = await upsertMatches(db, fdMatches)
  await resolveBonus(db, standingsRes.standings ?? [], fdMatches, scorersRes.scorers ?? [])
  await recomputeTips(db)
  await recomputeBonus(db)
  return out
}

export interface ManualResult {
  match_id: number; full_home: number; full_away: number; duration: MatchDuration; winner: Winner
}

export async function applyManualResult(db: Db, r: ManualResult): Promise<void> {
  const ft: Goals = { home: Number(r.full_home), away: Number(r.full_away) }
  const eff = effectiveGoals(ft, r.duration, r.winner)
  await db.from('matches').update({
    full_home: ft.home, full_away: ft.away, duration: r.duration, winner: r.winner,
    eff_home: eff.home, eff_away: eff.away, status: 'FINISHED',
  }).eq('id', Number(r.match_id))
  await recomputeTips(db)
}

/**
 * 1X2-Quoten von The Odds API holen und je Spiel speichern (Durchschnitt aller
 * Buchmacher). Abgleich über das ungeordnete Teamnamen-Paar (WM = neutraler Ort,
 * Heim/Auswärts kann vertauscht sein) — die Quoten werden per Teamname zugeordnet.
 */
export async function syncOdds(db: Db, oddsFetch: OddsFetch): Promise<{ matched: number; events: number }> {
  const events = (await oddsFetch()) ?? []

  const { data: teams } = await db.from('teams').select('id, name')
  const tname = new Map<string, string>((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))
  const { data: matches } = await db.from('matches').select('id, home_team_id, away_team_id')

  const byPair = new Map<string, { id: number; homeNorm: string; awayNorm: string }>()
  for (const m of matches ?? []) {
    if (!m.home_team_id || !m.away_team_id) continue
    const hn = normName(tname.get(m.home_team_id)), an = normName(tname.get(m.away_team_id))
    if (hn && an) byPair.set([hn, an].sort().join('|'), { id: m.id, homeNorm: hn, awayNorm: an })
  }

  let matched = 0
  for (const ev of events) {
    const our = byPair.get([normName(ev.home_team), normName(ev.away_team)].sort().join('|'))
    if (!our) continue
    // Durchschnittsquote je Outcome (Teamname bzw. 'draw') über alle Buchmacher
    const sum = new Map<string, number>(), cnt = new Map<string, number>()
    for (const bk of ev.bookmakers ?? []) {
      const mk = (bk.markets ?? []).find((x: { key: string }) => x.key === 'h2h')
      for (const o of mk?.outcomes ?? []) {
        const k = normName(o.name)
        sum.set(k, (sum.get(k) ?? 0) + Number(o.price)); cnt.set(k, (cnt.get(k) ?? 0) + 1)
      }
    }
    const avg = (k: string) => (cnt.get(k) ? Number((sum.get(k)! / cnt.get(k)!).toFixed(2)) : null)
    const oddHome = avg(our.homeNorm), oddAway = avg(our.awayNorm), oddDraw = avg('draw')
    if (oddHome && oddAway && oddDraw) {
      await db.from('matches').update({
        odd_home: oddHome, odd_draw: oddDraw, odd_away: oddAway, odds_updated: new Date().toISOString(),
      }).eq('id', our.id)
      matched++
    }
  }
  return { matched, events: events.length }
}

// ---------------------------------------------------------------------------
async function upsertMatches(db: Db, fdMatches: FdMatch[]): Promise<SyncResult> {
  // 1) Teams
  const teams = new Map<string, Record<string, unknown>>()
  for (const m of fdMatches) {
    for (const side of [m.homeTeam, m.awayTeam]) {
      if (!side?.id) continue
      const id = String(side.id)
      const gl = m.stage === 'GROUP_STAGE' ? groupLetter(m.group) : null
      const existing = teams.get(id)
      teams.set(id, {
        id, name: side.name ?? side.tla ?? id, short_name: side.shortName ?? null,
        tla: side.tla ?? null, iso2: null, crest_url: side.crest ?? null,
        group_letter: gl ?? (existing?.group_letter as string | null) ?? null,
      })
    }
  }
  if (teams.size) {
    const { error } = await db.from('teams').upsert([...teams.values()])
    if (error) throw new Error(`teams upsert: ${error.message}`)
  }

  // 2) Unsere Spieltage
  const ourMd = new Map<number, number>()
  const group = fdMatches.filter((m) => m.stage === 'GROUP_STAGE')
  const byKickoff = (a: FdMatch, b: FdMatch) => a.utcDate.localeCompare(b.utcDate) || a.id - b.id
  const r12 = group.filter((m) => m.matchday === 1 || m.matchday === 2)
    .sort((a, b) => (a.matchday! - b.matchday!) || byKickoff(a, b))
  const r3 = group.filter((m) => m.matchday === 3).sort(byKickoff)
  r12.forEach((m, i) => ourMd.set(m.id, 1 + Math.floor(i / 8)))   // ST 1..6 (je 8)
  r3.forEach((m, i) => ourMd.set(m.id, 7 + Math.floor(i / 6)))    // ST 7..10 (je 6)
  for (const m of fdMatches) {
    if (m.stage === 'GROUP_STAGE') continue
    ourMd.set(m.id, 10 + (KO_RANK[m.stage] ?? 9)) // KO ab ST 11; Platz 3 + Finale = ST 15
  }

  // 3) Spiele upserten
  // Bekannten Stand lesen, damit eine veraltete API-Antwort (stale Cache) weder
  // einen Live-Zwischenstand auf 0:0 noch ein bestätigtes Endergebnis zurücksetzt.
  interface ExRow {
    id: number; status: string; live_home: number | null; live_away: number | null
    full_home: number | null; full_away: number | null; duration: string | null
    winner: string | null; eff_home: number | null; eff_away: number | null
  }
  const { data: existing } = await db.from('matches')
    .select('id, status, live_home, live_away, full_home, full_away, duration, winner, eff_home, eff_away')
  const exById = new Map<number, ExRow>(((existing ?? []) as ExRow[]).map((e) => [e.id, e]))
  const now = Date.now()
  const liveDbg: string[] = []
  const rows = fdMatches.map((m) => {
    const raw = m.status
    let st = mapStatus(raw)
    const ko = Date.parse(m.utcDate)
    const shouldRun = now >= ko && now - ko <= LIVE_GRACE_MS
    const ex = exById.get(m.id)
    // Einmal bestätigt = bestätigt: Ein FINISHED-Spiel (vom Sync oder Admin
    // gesetzt) fällt nie auf eine veraltete Nicht-FINISHED-Antwort zurück.
    // Erst eine echte FINISHED-Antwort der API überschreibt es wieder.
    if (ex?.status === 'FINISHED' && st !== 'FINISHED') {
      liveDbg.push(`${m.id}:${raw}->FINISHED(kept)`)
      return {
        id: m.id,
        matchday: ourMd.get(m.id) ?? 99,
        stage: STAGE_MAP[m.stage] ?? 'GROUP',
        group_letter: m.stage === 'GROUP_STAGE' ? groupLetter(m.group) : null,
        kickoff: m.utcDate,
        status: 'FINISHED',
        home_team_id: m.homeTeam?.id ? String(m.homeTeam.id) : null,
        away_team_id: m.awayTeam?.id ? String(m.awayTeam.id) : null,
        full_home: ex.full_home,
        full_away: ex.full_away,
        duration: ex.duration ?? 'REGULAR',
        winner: ex.winner,
        eff_home: ex.eff_home,
        eff_away: ex.eff_away,
        live_home: null,
        live_away: null,
      }
    }
    // Anti-Flackern: API meldet TIMED/SCHEDULED, obwohl das Spiel laufen müsste
    // -> LIVE halten statt zurückstufen. (POSTPONED/CANCELLED bleiben unberührt.)
    if (st === 'SCHEDULED' && (raw === 'TIMED' || raw === 'SCHEDULED') && shouldRun) st = 'LIVE'
    const finished = st === 'FINISHED' && m.score.fullTime.home != null
    const live = st === 'LIVE'
    // Nur echte Live-Antworten tragen einen aktuellen Spielstand; bei einem
    // Cache-Rückfall den zuletzt bekannten Stand behalten (Fallback 0:0).
    const fresh = raw === 'IN_PLAY' || raw === 'PAUSED'
    const ft: Goals = { home: m.score.fullTime.home ?? 0, away: m.score.fullTime.away ?? 0 }
    const eff = finished ? effectiveGoals(ft, m.score.duration as MatchDuration, m.score.winner as Winner) : null
    const liveHome = live ? (fresh ? ft.home : (ex?.live_home ?? m.score.fullTime.home ?? 0)) : null
    const liveAway = live ? (fresh ? ft.away : (ex?.live_away ?? m.score.fullTime.away ?? 0)) : null
    if (live || shouldRun) liveDbg.push(`${m.id}:${raw}->${st}@${liveHome ?? '-'}:${liveAway ?? '-'}`)
    return {
      id: m.id,
      matchday: ourMd.get(m.id) ?? 99,
      stage: STAGE_MAP[m.stage] ?? 'GROUP',
      group_letter: m.stage === 'GROUP_STAGE' ? groupLetter(m.group) : null,
      kickoff: m.utcDate,
      status: st,
      home_team_id: m.homeTeam?.id ? String(m.homeTeam.id) : null,
      away_team_id: m.awayTeam?.id ? String(m.awayTeam.id) : null,
      full_home: finished ? ft.home : null,
      full_away: finished ? ft.away : null,
      duration: m.score.duration ?? 'REGULAR',
      winner: m.score.winner ?? null,
      eff_home: eff?.home ?? null,
      eff_away: eff?.away ?? null,
      live_home: liveHome,
      live_away: liveAway,
    }
  })
  if (rows.length) {
    const { error } = await db.from('matches').upsert(rows)
    if (error) throw new Error(`matches upsert: ${error.message}`)
  }

  // 4) Bonus-Deadline = frühester Anstoß
  const firstKick = fdMatches.map((m) => m.utcDate).sort()[0]
  if (firstKick) await db.from('app_settings').update({ bonus_deadline: firstKick }).eq('id', 1)

  return { teams: teams.size, matches: rows.length, live: liveDbg }
}

async function resolveBonus(
  db: Db,
  standings: Array<{ type?: string; group?: string | null; table?: Array<{ team: { id: number } }> }>,
  matches: FdMatch[],
  scorers: Array<{ team?: { id?: number } }>,
) {
  // Gruppensieger NUR werten, wenn die Gruppe komplett ausgespielt ist.
  // (Vorläufige Tabellenplätze = Setzliste dürfen keine Antwort/keinen Haken
  //  erzeugen.) Sonst Antwort explizit auf null -> räumt Voreiliges wieder auf.
  const gc = new Map<string, { total: number; fin: number }>()
  for (const m of matches) {
    if (m.stage !== 'GROUP_STAGE') continue
    const letter = groupLetter(m.group)
    if (!letter) continue
    const e = gc.get(letter) ?? { total: 0, fin: 0 }
    e.total++
    if (mapStatus(m.status) === 'FINISHED') e.fin++
    gc.set(letter, e)
  }
  const groupComplete = (letter: string) => {
    const e = gc.get(letter); return !!e && e.total > 0 && e.fin === e.total
  }
  const leaderByLetter = new Map<string, number | undefined>()
  for (const s of standings) {
    if (s.type && s.type !== 'TOTAL') continue
    const letter = groupLetter(s.group ?? null)
    if (letter) leaderByLetter.set(letter, s.table?.[0]?.team?.id)
  }
  for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
    const winner = groupComplete(letter) ? leaderByLetter.get(letter) : undefined
    await db.from('bonus_questions').update({ answer: winner ? [String(winner)] : null }).eq('id', `group_${letter}`)
  }

  // Weltmeister: erst nach beendetem Finale.
  const final = matches.find((m) => m.stage === 'FINAL' && mapStatus(m.status) === 'FINISHED')
  const champ = final?.score.winner === 'HOME_TEAM' ? final.homeTeam.id
    : final?.score.winner === 'AWAY_TEAM' ? final?.awayTeam.id : null
  await db.from('bonus_questions').update({ answer: champ ? [String(champ)] : null }).eq('id', 'champion')

  // Halbfinalisten: sobald die 4 Teams feststehen (Halbfinal-Paarungen gesetzt).
  const semis = matches.filter((m) => m.stage === 'SEMI_FINALS')
  const semiTeams = [...new Set(semis.flatMap((m) => [m.homeTeam.id, m.awayTeam.id]).filter(Boolean))].map(String)
  await db.from('bonus_questions').update({ answer: semiTeams.length === 4 ? semiTeams : null }).eq('id', 'semifinalists')

  // Team des Torschützenkönigs: erst zu Turnierende (Finale beendet).
  const topScorerTeam = final ? scorers[0]?.team?.id : undefined
  await db.from('bonus_questions').update({ answer: topScorerTeam ? [String(topScorerTeam)] : null }).eq('id', 'top_scorer')
}

async function recomputeTips(db: Db) {
  const { data: matches } = await db.from('matches').select('id, status, eff_home, eff_away')
  const eff = new Map<number, Goals | null>()
  for (const m of matches ?? []) {
    eff.set(m.id, m.status === 'FINISHED' && m.eff_home != null ? { home: m.eff_home, away: m.eff_away } : null)
  }
  const { data: tips } = await db.from('tips').select('*')
  const updates = (tips ?? []).map((t: { match_id: number; home: number; away: number }) => {
    const a = eff.get(t.match_id)
    return { ...t, points: a ? scoreMatch({ home: t.home, away: t.away }, a) : null }
  })
  await upsertChunked(db, 'tips', updates)
}

async function recomputeBonus(db: Db) {
  const { data: questions } = await db.from('bonus_questions').select('*')
  const qmap = new Map((questions ?? []).map((q: { id: string }) => [q.id, q]))
  const { data: tips } = await db.from('bonus_tips').select('*')
  const updates = (tips ?? []).map((t: { question_id: string; picks: string[] }) => {
    const q = qmap.get(t.question_id) as { kind: string; answer: string[] | null } | undefined
    let points: number | null = null
    if (q?.answer) {
      // single (Gruppensieger/Weltmeister/Torschützen-Team) = exakter Team-Vergleich; set = Schnittmenge
      if (q.kind === 'set') points = scoreBonusSet(t.picks, q.answer)
      else points = scoreBonusSingle(t.picks[0], q.answer[0])
    }
    return { ...t, points }
  })
  await upsertChunked(db, 'bonus_tips', updates)
}

async function upsertChunked(db: Db, table: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    if (chunk.length) {
      const { error } = await db.from(table).upsert(chunk)
      if (error) throw new Error(`${table} upsert: ${error.message}`)
    }
  }
}
