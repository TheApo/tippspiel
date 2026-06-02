/**
 * Wertungs-Engine — Single Source of Truth für alle Punkte.
 *
 * Wird sowohl vom Frontend (Anzeige/Vorschau) als auch von der Edge-Function
 * (autoritative Berechnung, schreibt Punkte in die DB) importiert.
 * Reines TypeScript ohne Abhängigkeiten -> läuft in Deno UND Node/Vitest.
 *
 * Regeln (bestätigt):
 *  - Tendenz richtig (Sieger/Remis) ......................... 2
 *  - bei Sieg zusätzlich Tordifferenz richtig ............... 3
 *  - exaktes Ergebnis ....................................... 4
 *  - Remis: nur Tendenz = 2, exaktes Remis = 4 (kein "3")
 *  - Bonus: 4 Punkte je richtigem Tipp
 *  - K.o.: gewertet wird das Ergebnis inkl. Verlängerung; bei
 *    Elfmeterschießen bekommt der Sieger +1 Tor (kicktipp-Konvention).
 */

export const POINTS = {
  EXACT: 4,
  DIFFERENCE: 3,
  TENDENCY: 2,
  MISS: 0,
  BONUS_PER_HIT: 4,
} as const

export interface Goals {
  home: number
  away: number
}

/** -1 = Auswärtssieg, 0 = Remis, 1 = Heimsieg */
export function tendency(g: Goals): -1 | 0 | 1 {
  if (g.home > g.away) return 1
  if (g.home < g.away) return -1
  return 0
}

/**
 * Punkte für einen einzelnen Spiel-Tipp nach der 2/3/4-Regel.
 * `actual` muss bereits das *gewertete* Ergebnis sein (siehe effectiveGoals).
 */
export function scoreMatch(pred: Goals, actual: Goals): number {
  const pt = tendency(pred)
  const at = tendency(actual)
  if (pt !== at) return POINTS.MISS

  // Tendenz stimmt:
  if (pred.home === actual.home && pred.away === actual.away) return POINTS.EXACT
  if (at === 0) return POINTS.TENDENCY // Remis getroffen, aber nicht exakt -> 2 (kein 3)
  if (pred.home - pred.away === actual.home - actual.away) return POINTS.DIFFERENCE
  return POINTS.TENDENCY
}

/** football-data.org duration-Werte */
export type MatchDuration = 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'
export type Winner = 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null

/**
 * Wandelt das Roh-Ergebnis (Stand nach reg. Spielzeit/Verlängerung) in das
 * gewertete Ergebnis um. Bei Elfmeterschießen erhält der Sieger +1 Tor,
 * damit es immer einen Sieger gibt und die 2/3/4-Regel greift.
 */
export function effectiveGoals(
  fullTime: Goals,
  duration: MatchDuration,
  winner: Winner,
): Goals {
  if (duration !== 'PENALTY_SHOOTOUT') return { ...fullTime }
  if (winner === 'HOME_TEAM') return { home: fullTime.home + 1, away: fullTime.away }
  if (winner === 'AWAY_TEAM') return { home: fullTime.home, away: fullTime.away + 1 }
  return { ...fullTime }
}

/** Bonus mit Einzel-Antwort (Gruppensieger, Weltmeister, Torschützenkönig). */
export function scoreBonusSingle(
  pred: string | null | undefined,
  actual: string | null | undefined,
): number {
  if (!pred || !actual) return POINTS.MISS
  return pred === actual ? POINTS.BONUS_PER_HIT : POINTS.MISS
}

/**
 * Bonus mit Mengen-Antwort (Halbfinalisten: genau 4 Teams getippt).
 * 4 Punkte je korrekt benanntem Team.
 */
export function scoreBonusSet(
  pred: readonly string[] | null | undefined,
  actual: readonly string[] | null | undefined,
): number {
  if (!pred?.length || !actual?.length) return POINTS.MISS
  const target = new Set(actual)
  let hits = 0
  for (const id of new Set(pred)) if (target.has(id)) hits++
  return hits * POINTS.BONUS_PER_HIT
}
