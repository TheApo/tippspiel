// Wiederverwendbare Supabase-Abfragen (DRY) — eine Stelle für alle Lesezugriffe.
import { supabase } from './supabase'
import type {
  Team, Match, AppSettings, UserTotals, MatchdayPoints, Tip, BonusQuestion, BonusTip,
  Profile, TipStatus, BonusStatus,
} from './types'

export async function fetchTeams(): Promise<Team[]> {
  const { data } = await supabase.from('teams').select('*').order('name')
  return (data as Team[]) ?? []
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, display_name, is_admin, created_at')
    .order('display_name')
  return (data as Profile[]) ?? []
}

/** Tipps, die der aktuelle Nutzer sehen darf (eigene + fremde ab Anpfiff) — RLS regelt das. */
export async function fetchVisibleTips(): Promise<Tip[]> {
  const { data } = await supabase.from('tips').select('*')
  return (data as Tip[]) ?? []
}

/** Existenz-Status aller Tipps (ohne Ergebnis) — fuer die "hat getippt"-Anzeige. */
export async function fetchTipStatus(): Promise<TipStatus[]> {
  const { data } = await supabase.from('v_tip_status').select('*')
  return (data as TipStatus[]) ?? []
}

export async function fetchBonusStatus(): Promise<BonusStatus[]> {
  const { data } = await supabase.from('v_bonus_status').select('*')
  return (data as BonusStatus[]) ?? []
}

export async function fetchMatches(): Promise<Match[]> {
  const { data } = await supabase.from('matches').select('*').order('matchday').order('kickoff')
  return (data as Match[]) ?? []
}

export async function fetchSettings(): Promise<AppSettings | null> {
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  return (data as AppSettings) ?? null
}

export async function fetchUserTotals(): Promise<UserTotals[]> {
  const { data } = await supabase
    .from('v_user_totals')
    .select('*')
    .order('total', { ascending: false })
    .order('exact_hits', { ascending: false })
    .order('display_name')
  return (data as UserTotals[]) ?? []
}

export async function fetchMatchdayPoints(): Promise<MatchdayPoints[]> {
  const { data } = await supabase.from('v_matchday_points').select('*')
  return (data as MatchdayPoints[]) ?? []
}

export async function fetchMyTips(userId: string): Promise<Tip[]> {
  const { data } = await supabase.from('tips').select('*').eq('user_id', userId)
  return (data as Tip[]) ?? []
}

export async function fetchTipsForMatches(matchIds: number[]): Promise<Tip[]> {
  if (!matchIds.length) return []
  const { data } = await supabase.from('tips').select('*').in('match_id', matchIds)
  return (data as Tip[]) ?? []
}

export async function fetchBonusQuestions(): Promise<BonusQuestion[]> {
  const { data } = await supabase.from('bonus_questions').select('*').order('sort')
  return (data as BonusQuestion[]) ?? []
}

export async function fetchMyBonusTips(userId: string): Promise<BonusTip[]> {
  const { data } = await supabase.from('bonus_tips').select('*').eq('user_id', userId)
  return (data as BonusTip[]) ?? []
}

// Schreiben über RPCs (serverseitige Deadline-Prüfung)
export async function saveTip(matchId: number, home: number, away: number) {
  const { error } = await supabase.rpc('upsert_tip', { p_match_id: matchId, p_home: home, p_away: away })
  if (error) throw error
}

export async function saveBonusTip(questionId: string, picks: string[]) {
  const { error } = await supabase.rpc('upsert_bonus_tip', { p_question_id: questionId, p_picks: picks })
  if (error) throw error
}
