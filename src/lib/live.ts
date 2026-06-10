// Live-Helfer: Zwischenstand + vorläufige Punkte laufender Spiele.
// Punkte werden mit der EINEN Wertungs-Engine (scoring.ts) berechnet und im
// Frontend den bestätigten Totals überlagert (DB bleibt bis Abpfiff unberührt).
import { scoreMatch, type Goals } from '../../supabase/functions/_shared/scoring.ts'
import type { Match, Tip } from './types'

export function isLive(m: Match): boolean {
  return m.status === 'LIVE' && m.live_home != null && m.live_away != null
}

/** Aktueller Live-Stand eines Spiels, oder null wenn nicht live. */
export function liveGoals(m: Match): Goals | null {
  return isLive(m) ? { home: m.live_home as number, away: m.live_away as number } : null
}

/** Vorläufige Punkte eines Tipps gegen den Live-Stand (null, wenn Spiel nicht live). */
export function liveTipPoints(tip: { home: number; away: number } | undefined, m: Match): number | null {
  const g = liveGoals(m)
  if (!g || !tip) return null
  return scoreMatch({ home: tip.home, away: tip.away }, g)
}

export interface LiveDelta {
  /** vorläufige Live-Punkte gesamt */
  total: number
  /** vorläufige Live-Punkte je Spieltag */
  byMd: Map<number, number>
}

function add(out: Map<string, LiveDelta>, key: string, md: number, pts: number) {
  let d = out.get(key)
  if (!d) { d = { total: 0, byMd: new Map() }; out.set(key, d) }
  d.total += pts
  d.byMd.set(md, (d.byMd.get(md) ?? 0) + pts)
}

/** Vorläufige Live-Punkte je Nutzer (Einzelwertung). */
export function userLiveDeltas(liveMatches: Match[], tips: Tip[]): Map<string, LiveDelta> {
  const mById = new Map(liveMatches.map((m) => [m.id, m]))
  const out = new Map<string, LiveDelta>()
  for (const t of tips) {
    const m = mById.get(t.match_id)
    if (!m) continue
    const p = liveTipPoints(t, m)
    if (p == null) continue
    add(out, t.user_id, m.matchday, p)
  }
  return out
}

/**
 * Vorläufige Live-Punkte je Gruppe und Spiel (key `${group_id}|${match_id}`):
 * pro Spiel der Durchschnitt der aktiven Mitglieder, die getippt haben
 * (gleiche Regel wie die bestätigte Gruppenwertung).
 */
export function groupLiveMatchAvgs(
  liveMatches: Match[],
  tips: Tip[],
  activeMembers: Array<{ group_id: string; user_id: string }>,
): Map<string, number> {
  const tipBy = new Map(tips.map((t) => [`${t.user_id}|${t.match_id}`, t]))
  const byGroup = new Map<string, string[]>()
  for (const mem of activeMembers) {
    if (!byGroup.has(mem.group_id)) byGroup.set(mem.group_id, [])
    byGroup.get(mem.group_id)!.push(mem.user_id)
  }
  const out = new Map<string, number>()
  for (const m of liveMatches) {
    const g = liveGoals(m)
    if (!g) continue
    for (const [gid, users] of byGroup) {
      let sum = 0, n = 0
      for (const uid of users) {
        const t = tipBy.get(`${uid}|${m.id}`)
        if (!t) continue
        sum += scoreMatch({ home: t.home, away: t.away }, g); n++
      }
      if (n > 0) out.set(`${gid}|${m.id}`, sum / n)
    }
  }
  return out
}

/** Vorläufige Live-Punkte je Gruppe (aus den per-Spiel-Durchschnitten aggregiert). */
export function groupLiveDeltas(
  liveMatches: Match[],
  tips: Tip[],
  activeMembers: Array<{ group_id: string; user_id: string }>,
): Map<string, LiveDelta> {
  const avgs = groupLiveMatchAvgs(liveMatches, tips, activeMembers)
  const mById = new Map(liveMatches.map((m) => [m.id, m]))
  const out = new Map<string, LiveDelta>()
  for (const [key, avg] of avgs) {
    const m = mById.get(Number(key.split('|')[1]))
    if (m) add(out, key.split('|')[0], m.matchday, avg)
  }
  return out
}
