// Datum/Zeit + Tipp-Status-Helfer

export function kickoffLocked(kickoff: string, now: number = Date.now()): boolean {
  return new Date(kickoff).getTime() <= now
}

export function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    weekday: 'short', day: '2-digit', month: 'short',
  })
}

export function fmtTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export function fmtDateTime(iso: string, locale: string): string {
  return `${fmtDate(iso, locale)} · ${fmtTime(iso, locale)}`
}

/** kurze Initialen für Avatare */
export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

/** Maximale Länge eines Anzeigenamens (Eingabe + Anzeige). */
export const MAX_NAME = 30

/** Teilnehmername auf max. MAX_NAME Zeichen kürzen — längere mit „…" abschneiden */
export function truncateName(name: string | null | undefined, max = MAX_NAME): string {
  const n = (name ?? '').trim()
  return n.length > max ? n.slice(0, max).trimEnd() + '…' : n
}

/** Gruppen-Punkte (Durchschnitte): max. 1 Nachkommastelle, lokalisiert (DE-Komma). */
export function fmtPts(n: number | string | null | undefined, locale: string): string {
  return Number(n ?? 0).toLocaleString(locale === 'en' ? 'en' : 'de', { maximumFractionDigits: 1 })
}

/** CSS-Klasse für eine Punktzahl (Farbcodierung 4/3/2/0) */
export function ptsClass(points: number | null | undefined): string {
  if (points === 4) return 'pts p4'
  if (points === 3) return 'pts p3'
  if (points === 2) return 'pts p2'
  return 'pts p0'
}
