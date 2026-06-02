// Domänen-/DB-Typen (Spiegel des Supabase-Schemas)

export type Stage =
  | 'GROUP'
  | 'LAST_32'
  | 'LAST_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'THIRD_PLACE'
  | 'FINAL'

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED'
export type Duration = 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'

export interface Team {
  id: string
  name: string
  short_name: string | null
  tla: string | null
  iso2: string | null
  crest_url: string | null
  group_letter: string | null
}

export interface Match {
  id: number
  matchday: number
  stage: Stage
  group_letter: string | null
  kickoff: string // ISO
  status: MatchStatus
  home_team_id: string | null
  away_team_id: string | null
  full_home: number | null
  full_away: number | null
  duration: Duration | null
  winner: string | null
  eff_home: number | null
  eff_away: number | null
  odd_home: number | null
  odd_draw: number | null
  odd_away: number | null
  odds_updated: string | null
}

export interface Tip {
  user_id: string
  match_id: number
  home: number
  away: number
  points: number | null
  updated_at: string
}

export type BonusCategory = 'group_winner' | 'champion' | 'semifinalists' | 'top_scorer'
export type BonusKind = 'single' | 'set'

export interface BonusQuestion {
  id: string
  category: BonusCategory
  kind: BonusKind
  group_letter: string | null
  sort: number
  answer: string[] | null
}

export interface BonusTip {
  user_id: string
  question_id: string
  picks: string[]
  points: number | null
  updated_at: string
}

export interface Profile {
  id: string
  email: string | null
  display_name: string
  is_admin: boolean
  created_at: string
}

export interface UserTotals {
  user_id: string
  display_name: string
  match_points: number
  bonus_points: number
  total: number
  exact_hits: number
}

export interface MatchdayPoints {
  user_id: string
  matchday: number
  points: number
}

export interface TipStatus {
  user_id: string
  match_id: number
}

export interface BonusStatus {
  user_id: string
  answered: number
}

export interface AppSettings {
  id: number
  admin_email: string
  bonus_deadline: string | null
  season: string
}

// Anzeige-Metadaten für Spieltage / Runden
export const STAGE_LABEL: Record<Stage, { de: string; en: string }> = {
  GROUP: { de: 'Gruppenphase', en: 'Group stage' },
  LAST_32: { de: 'Sechzehntelfinale', en: 'Round of 32' },
  LAST_16: { de: 'Achtelfinale', en: 'Round of 16' },
  QUARTER_FINALS: { de: 'Viertelfinale', en: 'Quarter-finals' },
  SEMI_FINALS: { de: 'Halbfinale', en: 'Semi-finals' },
  THIRD_PLACE: { de: 'Spiel um Platz 3', en: 'Third place' },
  FINAL: { de: 'Finale', en: 'Final' },
}
