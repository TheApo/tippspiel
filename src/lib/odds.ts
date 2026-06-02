// Aus Dezimalquoten implizite Wahrscheinlichkeiten (ohne Buchmacher-Marge) berechnen.
export interface Probs { home: number; draw: number; away: number }

export function impliedProbs(
  home?: number | null, draw?: number | null, away?: number | null,
): Probs | null {
  if (!home || !draw || !away) return null
  const ih = 1 / home, id = 1 / draw, ia = 1 / away
  const s = ih + id + ia
  if (!s) return null
  return {
    home: Math.round((ih / s) * 100),
    draw: Math.round((id / s) * 100),
    away: Math.round((ia / s) * 100),
  }
}
