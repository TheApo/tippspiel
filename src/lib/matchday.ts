import { STAGE_LABEL, type Match, type Stage } from './types'

// Rangfolge, um den "Kopf"-Charakter eines Spieltags zu bestimmen
// (z. B. Finaltag enthält Spiel um Platz 3 + Finale -> Kopf = Finale).
const RANK: Record<Stage, number> = {
  GROUP: 0, LAST_32: 1, LAST_16: 2, QUARTER_FINALS: 3, SEMI_FINALS: 4, THIRD_PLACE: 5, FINAL: 6,
}
const SHORT: Record<Stage, string> = {
  GROUP: '', LAST_32: '⅟16', LAST_16: '⅛', QUARTER_FINALS: 'VF', SEMI_FINALS: 'HF', THIRD_PLACE: 'P3', FINAL: 'FIN',
}

export function headlineStage(matches: Match[]): Stage | null {
  let best: Stage | null = null
  for (const m of matches) if (best === null || RANK[m.stage] > RANK[best]) best = m.stage
  return best
}

/** Voller Spieltag-Titel: Gruppe -> "n. Spieltag", sonst die (höchste) Runde. */
export function matchdayLabel(matches: Match[], day: number, lng: string): string {
  const s = headlineStage(matches)
  if (!s || s === 'GROUP') return lng === 'en' ? `Matchday ${day}` : `${day}. Spieltag`
  return STAGE_LABEL[s][lng === 'en' ? 'en' : 'de']
}

/** Kurzlabel für Tabellen-Spalten (Gesamtliste). */
export function matchdayShort(matches: Match[], day: number): string {
  const s = headlineStage(matches)
  if (!s || s === 'GROUP') return String(day)
  return SHORT[s] || String(day)
}

/** Bezeichnung eines einzelnen Spiels: "Gruppe X" oder die Runde. */
export function matchLabel(m: Match, lng: string, groupWord: string): string {
  if (m.stage === 'GROUP') return m.group_letter ? `${groupWord} ${m.group_letter}` : ''
  return STAGE_LABEL[m.stage][lng === 'en' ? 'en' : 'de']
}
