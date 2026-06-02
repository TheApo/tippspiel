import type { Team } from './types'

// Deutsche Ländernamen je FIFA-3-Letter-Code (football-data liefert englische Namen).
// Fehlt ein Code, wird der englische DB-Name verwendet.
const DE_NAMES: Record<string, string> = {
  GER: 'Deutschland', BRA: 'Brasilien', FRA: 'Frankreich', ARG: 'Argentinien',
  ESP: 'Spanien', POR: 'Portugal', ENG: 'England', NED: 'Niederlande', ITA: 'Italien',
  BEL: 'Belgien', CRO: 'Kroatien', URU: 'Uruguay', USA: 'USA', MEX: 'Mexiko',
  CAN: 'Kanada', JPN: 'Japan', KOR: 'Südkorea', AUS: 'Australien', SUI: 'Schweiz',
  DEN: 'Dänemark', SRB: 'Serbien', POL: 'Polen', MAR: 'Marokko', SEN: 'Senegal',
  GHA: 'Ghana', CMR: 'Kamerun', NGA: 'Nigeria', EGY: 'Ägypten', TUN: 'Tunesien',
  ALG: 'Algerien', CIV: 'Elfenbeinküste', ECU: 'Ecuador', COL: 'Kolumbien',
  PER: 'Peru', CHI: 'Chile', PAR: 'Paraguay', QAT: 'Katar', KSA: 'Saudi-Arabien',
  IRN: 'Iran', AUT: 'Österreich', SCO: 'Schottland', WAL: 'Wales', TUR: 'Türkei',
  UKR: 'Ukraine', NOR: 'Norwegen', SWE: 'Schweden', GRE: 'Griechenland',
  CZE: 'Tschechien', RSA: 'Südafrika', NZL: 'Neuseeland', PAN: 'Panama',
  CRC: 'Costa Rica', HON: 'Honduras', JAM: 'Jamaika', HAI: 'Haiti',
  BIH: 'Bosnien-Herzegowina', SVK: 'Slowakei', SVN: 'Slowenien', HUN: 'Ungarn',
  ROU: 'Rumänien', RUS: 'Russland', SLV: 'El Salvador', GUA: 'Guatemala',
  TRI: 'Trinidad und Tobago', CUW: 'Curaçao', SUR: 'Suriname', CPV: 'Kap Verde',
  UZB: 'Usbekistan', JOR: 'Jordanien', IRQ: 'Irak', UAE: 'Vereinigte Arab. Emirate',
  OMN: 'Oman', BHR: 'Bahrain', PLE: 'Palästina', COD: 'DR Kongo', ANG: 'Angola',
  MLI: 'Mali', BFA: 'Burkina Faso', GAB: 'Gabun', ZAM: 'Sambia', ZIM: 'Simbabwe',
  KEN: 'Kenia', UGA: 'Uganda', GUI: 'Guinea', BEN: 'Benin', TOG: 'Togo',
  MTN: 'Mauretanien', LBY: 'Libyen', SDN: 'Sudan', NAM: 'Namibia', MOZ: 'Mosambik',
  COM: 'Komoren', GAM: 'Gambia', BOL: 'Bolivien', VEN: 'Venezuela', CHN: 'China',
  THA: 'Thailand', VIE: 'Vietnam', IDN: 'Indonesien', IND: 'Indien', MAS: 'Malaysia',
  PRK: 'Nordkorea', FIN: 'Finnland', ISL: 'Island', IRL: 'Irland', NIR: 'Nordirland',
  ALB: 'Albanien', GEO: 'Georgien', MKD: 'Nordmazedonien', MNE: 'Montenegro',
  BUL: 'Bulgarien', ISR: 'Israel', LUX: 'Luxemburg', ARM: 'Armenien', AZE: 'Aserbaidschan',
  KAZ: 'Kasachstan', CYP: 'Zypern',
}

/** Lokalisierter Teamname: bei DE der deutsche Ländername, sonst der DB-Name. */
export function teamName(team: Pick<Team, 'name' | 'tla'> | null | undefined, lng?: string): string {
  if (!team) return '—'
  if (lng?.startsWith('de') && team.tla && DE_NAMES[team.tla]) return DE_NAMES[team.tla]
  return team.name ?? team.tla ?? '—'
}
