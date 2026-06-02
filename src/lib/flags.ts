import type { Team } from './types'

// Notfall-Mapping TLA -> ISO2 (flagcdn) für gängige Nationen, falls der Sync
// kein iso2 geliefert hat. Bevorzugt wird ohnehin team.crest_url (SVG-Flagge).
const TLA_ISO2: Record<string, string> = {
  GER: 'de', BRA: 'br', FRA: 'fr', ARG: 'ar', ESP: 'es', POR: 'pt', ENG: 'gb-eng',
  NED: 'nl', ITA: 'it', BEL: 'be', CRO: 'hr', URU: 'uy', USA: 'us', MEX: 'mx',
  CAN: 'ca', JPN: 'jp', KOR: 'kr', AUS: 'au', SUI: 'ch', DEN: 'dk', SRB: 'rs',
  POL: 'pl', MAR: 'ma', SEN: 'sn', GHA: 'gh', CMR: 'cm', NGA: 'ng', EGY: 'eg',
  TUN: 'tn', ALG: 'dz', CIV: 'ci', ECU: 'ec', COL: 'co', PER: 'pe', CHI: 'cl',
  PAR: 'py', QAT: 'qa', KSA: 'sa', IRN: 'ir', AUT: 'at', SCO: 'gb-sct', WAL: 'gb-wls',
  TUR: 'tr', UKR: 'ua', NOR: 'no', SWE: 'se', GRE: 'gr', CZE: 'cz', RSA: 'za',
  NZL: 'nz', PAN: 'pa', CRC: 'cr', HON: 'hn', JAM: 'jm',
}

function iso(team?: Pick<Team, 'iso2' | 'tla'> | null): string | null {
  if (!team) return null
  if (team.iso2) return team.iso2.toLowerCase()
  if (team.tla && TLA_ISO2[team.tla]) return TLA_ISO2[team.tla]
  return null
}

/** Liefert die beste Flaggen-URL für ein Team. */
export function flagUrl(team?: Pick<Team, 'crest_url' | 'iso2' | 'tla'> | null): string | null {
  if (team?.crest_url) return team.crest_url
  const code = iso(team)
  return code ? `https://flagcdn.com/${code}.svg` : null
}
