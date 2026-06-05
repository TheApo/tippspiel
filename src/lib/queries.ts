// Wiederverwendbare Supabase-Abfragen (DRY) — eine Stelle für alle Lesezugriffe.
import { supabase } from './supabase'
import type {
  Team, Match, AppSettings, UserTotals, MatchdayPoints, Tip, BonusQuestion, BonusTip,
  Profile, TipStatus, BonusStatus,
  Group, GroupMember, GroupTotals, GroupMatchdayPoints, GroupMatchPoints, JoinMode,
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

/** Anzeigenamen setzen — RLS: eigener Name immer, fremde nur als Admin. Trigger kappt auf 30 Zeichen. */
export async function updateDisplayName(userId: string, name: string) {
  const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId)
  if (error) throw error
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

/** Sichtbare Bonus-Tipps aller Teilnehmer (RLS: eigene immer, fremde ab Bonus-Deadline). */
export async function fetchBonusTips(): Promise<BonusTip[]> {
  const { data } = await supabase.from('bonus_tips').select('user_id, question_id, picks, points')
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

// ---------------------------------------------------------------------------
// Gruppen — Lesezugriffe
// ---------------------------------------------------------------------------
export async function fetchGroups(): Promise<Group[]> {
  const { data } = await supabase.from('groups').select('*').order('name')
  return (data as Group[]) ?? []
}

/** Alle sichtbaren Mitgliedschaften inkl. Anzeigename (RLS: aktive überall,
 *  eigene + Bewerber der eigenen Gruppen). Flach gemappt. */
export async function fetchGroupMembers(): Promise<GroupMember[]> {
  const { data } = await supabase
    .from('group_members')
    .select('group_id, user_id, status, profile:profiles(display_name)')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((r) => ({
    group_id: r.group_id, user_id: r.user_id, status: r.status,
    display_name: r.profile?.display_name ?? '?',
  }))
}

export async function fetchGroupTotals(): Promise<GroupTotals[]> {
  const { data } = await supabase.from('v_group_totals').select('*')
  return (data as GroupTotals[]) ?? []
}

export async function fetchGroupMatchdayPoints(): Promise<GroupMatchdayPoints[]> {
  const { data } = await supabase.from('v_group_matchday_points').select('*')
  return (data as GroupMatchdayPoints[]) ?? []
}

export async function fetchGroupMatchPoints(): Promise<GroupMatchPoints[]> {
  const { data } = await supabase.from('v_group_match_points').select('*')
  return (data as GroupMatchPoints[]) ?? []
}

// ---------------------------------------------------------------------------
// Gruppen — Schreiben über RPCs
// ---------------------------------------------------------------------------
export async function createGroup(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_group', { p_name: name })
  if (error) throw error
  return data as string
}

export async function joinGroup(groupId: string): Promise<MemberStatusResult> {
  const { data, error } = await supabase.rpc('join_group', { p_group_id: groupId })
  if (error) throw error
  return data as MemberStatusResult
}
type MemberStatusResult = 'active' | 'pending'

export async function leaveGroup(groupId: string) {
  const { error } = await supabase.rpc('leave_group', { p_group_id: groupId })
  if (error) throw error
}

export async function setGroup(groupId: string, name: string, joinMode: JoinMode) {
  const { error } = await supabase.rpc('set_group', { p_group_id: groupId, p_name: name, p_join_mode: joinMode })
  if (error) throw error
}

export async function approveMember(groupId: string, userId: string) {
  const { error } = await supabase.rpc('approve_member', { p_group_id: groupId, p_user_id: userId })
  if (error) throw error
}

export async function removeMember(groupId: string, userId: string) {
  const { error } = await supabase.rpc('remove_member', { p_group_id: groupId, p_user_id: userId })
  if (error) throw error
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.rpc('delete_group', { p_group_id: groupId })
  if (error) throw error
}
