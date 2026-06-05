import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  fetchMatches, fetchTeams, fetchProfiles, fetchVisibleTips, fetchTipStatus,
  fetchMatchdayPoints, fetchUserTotals, fetchBonusQuestions, fetchBonusTips,
  fetchGroupTotals, fetchGroupMatchPoints, fetchGroupMatchdayPoints,
} from '../lib/queries'
import {
  STAGE_LABEL, type Match, type Team, type Profile, type Tip, type TipStatus,
  type MatchdayPoints, type UserTotals, type BonusQuestion, type BonusTip,
  type GroupTotals, type GroupMatchPoints, type GroupMatchdayPoints,
} from '../lib/types'
import { fmtDate, fmtTime, kickoffLocked, ptsClass, truncateName, fmtPts } from '../lib/format'
import { matchdayLabel } from '../lib/matchday'
import { teamName } from '../lib/teamNames'
import { Flag } from '../components/Flag'

const MIN_GROUP = 2

export default function Tippuebersicht() {
  const { t, i18n } = useTranslation()
  const { session, profile } = useAuth()
  const lng = i18n.resolvedLanguage === 'en' ? 'en' : 'de'
  const me = session?.user.id

  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tips, setTips] = useState<Tip[]>([])
  const [status, setStatus] = useState<TipStatus[]>([])
  const [mdPoints, setMdPoints] = useState<MatchdayPoints[]>([])
  const [totals, setTotals] = useState<UserTotals[]>([])
  const [bonusQuestions, setBonusQuestions] = useState<BonusQuestion[]>([])
  const [bonusTips, setBonusTips] = useState<BonusTip[]>([])
  const [groupTotals, setGroupTotals] = useState<GroupTotals[]>([])
  const [groupMatchPts, setGroupMatchPts] = useState<GroupMatchPoints[]>([])
  const [groupMd, setGroupMd] = useState<GroupMatchdayPoints[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'md' | 'bonus'>('md')
  const [mode, setMode] = useState<'solo' | 'group'>('solo')
  const [md, setMd] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetchMatches(), fetchTeams(), fetchProfiles(), fetchVisibleTips(), fetchTipStatus(),
      fetchMatchdayPoints(), fetchUserTotals(), fetchBonusQuestions(), fetchBonusTips(),
      fetchGroupTotals(), fetchGroupMatchPoints(), fetchGroupMatchdayPoints(),
    ]).then(([m, tm, pr, tp, st, mp, to, bq, bt, gt, gmp, gmd]) => {
      setMatches(m); setTeams(tm); setProfiles(pr); setTips(tp); setStatus(st)
      setMdPoints(mp); setTotals(to); setBonusQuestions(bq); setBonusTips(bt)
      setGroupTotals(gt); setGroupMatchPts(gmp); setGroupMd(gmd)
    }).finally(() => setLoading(false))
  }, [])

  const teamsMap = useMemo(() => new Map(teams.map((x) => [x.id, x])), [teams])
  const matchesByMd = useMemo(() => {
    const m = new Map<number, Match[]>()
    for (const x of matches) { if (!m.has(x.matchday)) m.set(x.matchday, []); m.get(x.matchday)!.push(x) }
    for (const arr of m.values()) arr.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id - b.id)
    return m
  }, [matches])
  const matchdays = useMemo(() => [...matchesByMd.keys()].sort((a, b) => a - b), [matchesByMd])

  useEffect(() => {
    if (md !== null || matchdays.length === 0) return
    const open = matchdays.find((d) => (matchesByMd.get(d) ?? []).some((m) => !kickoffLocked(m.kickoff)))
    setMd(open ?? matchdays[0])
  }, [matchdays, matchesByMd, md])

  const tipsMap = useMemo(() => new Map(tips.map((t) => [`${t.user_id}|${t.match_id}`, t])), [tips])
  const statusSet = useMemo(() => new Set(status.map((s) => `${s.user_id}|${s.match_id}`)), [status])
  const mdPtsMap = useMemo(() => new Map(mdPoints.map((p) => [`${p.user_id}|${p.matchday}`, p.points])), [mdPoints])
  const totalsMap = useMemo(() => new Map(totals.map((u) => [u.user_id, u])), [totals])
  const bonusQs = useMemo(() => [...bonusQuestions].sort((a, b) => a.sort - b.sort), [bonusQuestions])
  const bonusTipsMap = useMemo(() => new Map(bonusTips.map((b) => [`${b.user_id}|${b.question_id}`, b.picks])), [bonusTips])
  const answersMap = useMemo(() => new Map(bonusQuestions.map((q) => [q.id, q.answer])), [bonusQuestions])
  const ptsOf = (u: string, day: number) => mdPtsMap.get(`${u}|${day}`) ?? 0

  // Eigenen Account immer in der Liste haben (Absicherung)
  const allProfiles = useMemo(() => {
    if (!me || profiles.some((p) => p.id === me)) return profiles
    return [...profiles, {
      id: me, email: profile?.email ?? null, display_name: profile?.display_name ?? 'Du',
      is_admin: false, created_at: '',
    }]
  }, [profiles, me, profile])

  const completeByMd = useMemo(() => {
    const c = new Map<number, boolean>()
    for (const [day, arr] of matchesByMd) c.set(day, arr.length > 0 && arr.every((x) => x.status === 'FINISHED'))
    return c
  }, [matchesByMd])

  // 🏆 Spieltagssiege (nur abgeschlossene Spieltage mit Punkten)
  const trophies = useMemo(() => {
    const tr = new Map<string, number>()
    for (const day of matchdays) {
      if (!completeByMd.get(day)) continue
      const max = Math.max(0, ...allProfiles.map((p) => ptsOf(p.id, day)))
      if (max <= 0) continue
      for (const p of allProfiles) if (ptsOf(p.id, day) === max) tr.set(p.id, (tr.get(p.id) ?? 0) + 1)
    }
    return tr
  }, [matchdays, completeByMd, allProfiles, mdPtsMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentWinners = useMemo(() => {
    const s = new Set<string>()
    if (md == null || !completeByMd.get(md)) return s
    const max = Math.max(0, ...allProfiles.map((p) => ptsOf(p.id, md)))
    if (max > 0) for (const p of allProfiles) if (ptsOf(p.id, md) === max) s.add(p.id)
    return s
  }, [md, completeByMd, allProfiles, mdPtsMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tipper sortiert nach Punkten dieses Spieltags (Tippübersicht), dann Gesamt
  const rows = useMemo(() => {
    return [...allProfiles].sort((a, b) => {
      if (md != null) { const d = ptsOf(b.id, md) - ptsOf(a.id, md); if (d) return d }
      const ta = totalsMap.get(a.id)?.total ?? 0, tb = totalsMap.get(b.id)?.total ?? 0
      return tb - ta || a.display_name.localeCompare(b.display_name)
    })
  }, [allProfiles, md, mdPtsMap, totalsMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Gruppen ----
  const groupRowsAll = useMemo(() => groupTotals.filter((g) => g.member_count >= MIN_GROUP), [groupTotals])
  const groupMatchMap = useMemo(() => new Map(groupMatchPts.map((p) => [`${p.group_id}|${p.match_id}`, Number(p.avg_points)])), [groupMatchPts])
  const groupMdMap = useMemo(() => new Map(groupMd.map((p) => [`${p.group_id}|${p.matchday}`, Number(p.points)])), [groupMd])
  const gPtsOf = (gid: string, day: number) => groupMdMap.get(`${gid}|${day}`) ?? 0

  const groupTrophies = useMemo(() => {
    const tr = new Map<string, number>()
    for (const day of matchdays) {
      if (!completeByMd.get(day)) continue
      const max = Math.max(0, ...groupRowsAll.map((g) => gPtsOf(g.group_id, day)))
      if (max <= 0) continue
      for (const g of groupRowsAll) if (gPtsOf(g.group_id, day) === max) tr.set(g.group_id, (tr.get(g.group_id) ?? 0) + 1)
    }
    return tr
  }, [matchdays, completeByMd, groupRowsAll, groupMdMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentGroupWinners = useMemo(() => {
    const s = new Set<string>()
    if (md == null || !completeByMd.get(md)) return s
    const max = Math.max(0, ...groupRowsAll.map((g) => gPtsOf(g.group_id, md)))
    if (max > 0) for (const g of groupRowsAll) if (gPtsOf(g.group_id, md) === max) s.add(g.group_id)
    return s
  }, [md, completeByMd, groupRowsAll, groupMdMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const groupRows = useMemo(() => {
    return [...groupRowsAll].sort((a, b) => {
      if (md != null) { const d = gPtsOf(b.group_id, md) - gPtsOf(a.group_id, md); if (d) return d }
      return Number(b.total) - Number(a.total) || a.name.localeCompare(b.name)
    })
  }, [groupRowsAll, md, groupMdMap]) // eslint-disable-line react-hooks/exhaustive-deps

  function mdLabel(day: number): string {
    return matchdayLabel(matchesByMd.get(day) ?? [], day, lng)
  }

  if (loading) return <div className="skeleton" style={{ height: 360 }} />
  if (matchdays.length === 0) return <div className="card pad muted">{t('uebersicht.empty')}</div>

  const idx = md != null ? matchdays.indexOf(md) : 0
  const dayMatches = md != null ? (matchesByMd.get(md) ?? []) : []
  const isGroup = mode === 'group'

  // Einzel-/Gruppenwertung-Umschalter — sitzt direkt über der (Kreuz-)Tabelle.
  const segTabs = (
    <div className="seg" role="tablist">
      <button role="tab" className={!isGroup ? 'on' : ''} onClick={() => setMode('solo')}>{t('common.solo')}</button>
      <button role="tab" className={isGroup ? 'on' : ''} onClick={() => setMode('group')}>{t('common.groups')}</button>
    </div>
  )

  return (
    <div className="stack" style={{ gap: 16 }}>
      <header>
        <span className="eyebrow">{t('nav.overview')}</span>
        <h1>{t('uebersicht.title')}{view === 'md' && md != null ? ` · ${mdLabel(md)}` : view === 'bonus' ? ` · ${t('uebersicht.bonusTab')}` : ''}</h1>
      </header>

      {/* Umschalter: Spieltag <-> + Bonus */}
      <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
        <button className="btn ghost sm" style={{ fontSize: '1rem', padding: '6px 14px', lineHeight: 1 }}
          disabled={idx <= 0} onClick={() => { setView('md'); setMd(matchdays[idx - 1]) }} aria-label="prev">◀</button>
        <select
          value={md != null ? String(md) : ''}
          onChange={(e) => { setView('md'); setMd(Number(e.target.value)) }}
          style={{ width: 'auto', minWidth: 180, fontWeight: 700, boxShadow: view === 'md' ? '0 0 0 2px var(--petrol-soft)' : 'none', borderColor: view === 'md' ? 'var(--petrol)' : 'var(--line)' }}
        >
          {matchdays.map((d) => <option key={d} value={d}>{mdLabel(d)}</option>)}
        </select>
        <button className="btn ghost sm" style={{ fontSize: '1rem', padding: '6px 14px', lineHeight: 1 }}
          disabled={idx >= matchdays.length - 1} onClick={() => { setView('md'); setMd(matchdays[idx + 1]) }} aria-label="next">▶</button>
        <button className={`btn sm ${view === 'bonus' ? 'accent' : 'ghost'}`} onClick={() => setView(view === 'bonus' ? 'md' : 'bonus')}>{t('uebersicht.bonusTab')}</button>
      </div>

      {view === 'bonus' ? (
        <>
          <MyBonusCard me={me} questions={bonusQs} teamsMap={teamsMap} tipsMap={bonusTipsMap}
            answersMap={answersMap} myBonus={me ? (totalsMap.get(me)?.bonus_points ?? 0) : 0} lng={lng} t={t} />
          {segTabs}
          {isGroup
            ? <GroupBonusOverview rows={groupRowsAll} t={t} />
            : <AllBonusTable rows={rows} me={me} questions={bonusQs} teamsMap={teamsMap}
                tipsMap={bonusTipsMap} answersMap={answersMap} totalsMap={totalsMap} t={t} />}
        </>
      ) : (
        <>
          {/* Spielliste */}
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('uebersicht.termin')}</th>
                  <th>{t('uebersicht.heim')}</th>
                  <th>{t('uebersicht.gast')}</th>
                  <th className="col-group">{t('uebersicht.gruppe')}</th>
                  <th className="num"><span className="lbl-full">{t('uebersicht.ergebnis')}</span><span className="lbl-short">{t('uebersicht.ergShort')}</span></th>
                </tr>
              </thead>
              <tbody>
                {dayMatches.map((m) => {
                  const home = teamsMap.get(m.home_team_id ?? ''); const away = teamsMap.get(m.away_team_id ?? '')
                  const fin = m.status === 'FINISHED' && m.full_home != null
                  const suffix = m.duration === 'PENALTY_SHOOTOUT' ? ' n.E.' : m.duration === 'EXTRA_TIME' ? ' n.V.' : ''
                  return (
                    <tr key={m.id}>
                      <td className="muted">{fmtDate(m.kickoff, lng)} {fmtTime(m.kickoff, lng)}</td>
                      <td><span className="row" style={{ gap: 8 }}><Flag team={home} /> <span className="lbl-full">{teamName(home, lng)}</span><span className="lbl-short" style={{ fontFamily: 'var(--font-mono)' }}>{home?.tla ?? teamName(home, lng)}</span></span></td>
                      <td><span className="row" style={{ gap: 8 }}><Flag team={away} /> <span className="lbl-full">{teamName(away, lng)}</span><span className="lbl-short" style={{ fontFamily: 'var(--font-mono)' }}>{away?.tla ?? teamName(away, lng)}</span></span></td>
                      <td className="muted col-group">{m.group_letter ? `${t('common.group')} ${m.group_letter}` : STAGE_LABEL[m.stage][lng]}</td>
                      <td className="num" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fin ? `${m.full_home}:${m.full_away}${suffix}` : '-:-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {segTabs}

          {/* Kreuztabelle: Einzel ODER Gruppe */}
          {isGroup && groupRowsAll.length === 0 ? (
            <div className="card pad muted">{t('uebersicht.noGroups')}</div>
          ) : (
            <div className="panel" style={{ overflowX: 'auto' }}>
              <table className="table sticky" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th className="col-pos" style={{ width: 38 }}>{t('uebersicht.pos')}</th>
                    <th>{isGroup ? t('leaderboard.groupCol') : t('uebersicht.name')}</th>
                    {dayMatches.map((m) => (
                      <th key={m.id} className="num" style={{ lineHeight: 1.15 }}>
                        <div style={{ fontFamily: 'var(--font-mono)' }}>{teamsMap.get(m.home_team_id ?? '')?.tla ?? '—'}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--gray)' }}>{teamsMap.get(m.away_team_id ?? '')?.tla ?? '—'}</div>
                      </th>
                    ))}
                    <th className="num" title={t('uebersicht.pTitle')}>{t('uebersicht.pShort')}</th>
                    <th className="num" title={t('uebersicht.bTitle')} style={{ color: 'var(--purpur)' }}>{t('uebersicht.bShort')}</th>
                    <th className="num" title={t('uebersicht.sTitle')}>{t('uebersicht.sShort')}</th>
                    <th className="num" title={t('uebersicht.gTitle')}>{t('uebersicht.gShort')}</th>
                  </tr>
                </thead>
                <tbody>
                  {isGroup
                    ? groupRows.map((g, i) => (
                      <tr key={g.group_id}>
                        <td className="col-pos" style={{ color: 'var(--navy-300)', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {currentGroupWinners.has(g.group_id) && <span title={t('uebersicht.mdWinner')}>🏆 </span>}
                          {truncateName(g.name)}
                          <span className="muted" style={{ marginLeft: 6, fontSize: '.8rem', fontWeight: 400 }}>· {g.member_count}</span>
                        </td>
                        {dayMatches.map((m) => (
                          <td key={m.id} className="num">
                            <GroupCell avg={groupMatchMap.get(`${g.group_id}|${m.id}`)} locked={kickoffLocked(m.kickoff)} />
                          </td>
                        ))}
                        <td className="num" style={{ fontWeight: 700 }}>{md != null ? fmtPts(gPtsOf(g.group_id, md), '') : '0'}</td>
                        <td className="num" style={{ color: 'var(--purpur)' }}>{Number(g.bonus_points) ? fmtPts(g.bonus_points, '') : '·'}</td>
                        <td className="num">{(groupTrophies.get(g.group_id) ?? 0) > 0 ? `🏆${groupTrophies.get(g.group_id)}` : '·'}</td>
                        <td className="num" style={{ fontWeight: 800 }}>{fmtPts(g.total, '')}</td>
                      </tr>
                    ))
                    : rows.map((p, i) => {
                      const isMe = p.id === me
                      const tot = totalsMap.get(p.id)
                      const tr = trophies.get(p.id) ?? 0
                      return (
                        <tr key={p.id} className={isMe ? 'me' : undefined} style={isMe ? { background: 'var(--cream)' } : undefined}>
                          <td className="col-pos" style={{ color: 'var(--navy-300)', fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {currentWinners.has(p.id) && <span title={t('uebersicht.mdWinner')}>🏆 </span>}
                            {truncateName(p.display_name)}
                            {isMe && <span className="badge petrol" style={{ marginLeft: 6 }}>{t('uebersicht.you')}</span>}
                          </td>
                          {dayMatches.map((m) => (
                            <td key={m.id} className="num"><TipCell tip={tipsMap.get(`${p.id}|${m.id}`)} tipped={statusSet.has(`${p.id}|${m.id}`)} locked={kickoffLocked(m.kickoff)} finished={m.status === 'FINISHED'} /></td>
                          ))}
                          <td className="num" style={{ fontWeight: 700 }}>{md != null ? ptsOf(p.id, md) : 0}</td>
                          <td className="num" style={{ color: 'var(--purpur)' }}>{tot?.bonus_points ?? 0}</td>
                          <td className="num">{tr > 0 ? `🏆${tr}` : '·'}</td>
                          <td className="num" style={{ fontWeight: 800 }}>{tot?.total ?? 0}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted" style={{ fontSize: '.8rem' }}>{t('uebersicht.hiddenHint')}</p>
        </>
      )}
    </div>
  )
}

function TipCell({ tip, tipped, locked, finished }: { tip?: Tip; tipped: boolean; locked: boolean; finished: boolean }) {
  if (tip) {
    const cls = finished && tip.points != null ? ptsClass(tip.points) : ''
    return <span className={cls} style={{ fontFamily: 'var(--font-mono)' }}>{tip.home}:{tip.away}</span>
  }
  if (!locked && tipped) return <span style={{ color: 'var(--petrol)' }} title="getippt">✓</span>
  if (!locked) return <span style={{ color: 'var(--gray)' }}>–</span>
  return <span style={{ color: 'var(--gray)', fontFamily: 'var(--font-mono)' }}>-:-</span>
}

/** Eine Zelle der Gruppen-Kreuztabelle: Ø-Punkte der Gruppe für ein Spiel. */
function GroupCell({ avg, locked }: { avg?: number; locked: boolean }) {
  if (avg != null) return <span className={ptsClass(Math.round(avg))} style={{ fontFamily: 'var(--font-mono)' }}>{fmtPts(avg, '')}</span>
  return <span style={{ color: 'var(--gray)', fontFamily: 'var(--font-mono)' }}>{locked ? '·' : '–'}</span>
}

type TFn = (key: string, opts?: Record<string, unknown>) => string

const bonusLabel = (q: BonusQuestion, t: TFn): string =>
  q.category === 'group_winner' ? t('bonus.groupWinner', { group: q.group_letter })
    : q.category === 'champion' ? t('bonus.champion')
    : q.category === 'semifinalists' ? t('bonus.semifinalists')
    : t('bonus.topScorer')

const bonusShort = (q: BonusQuestion, t: TFn): string =>
  q.category === 'group_winner' ? (q.group_letter ?? '?')
    : q.category === 'champion' ? t('uebersicht.champShort')
    : q.category === 'semifinalists' ? t('uebersicht.semiShort')
    : t('uebersicht.scorerShort')

/** Persönliche, read-only Übersicht der eigenen Bonus-Tipps (✓ wenn korrekt). */
function MyBonusCard({ me, questions, teamsMap, tipsMap, answersMap, myBonus, lng, t }: {
  me?: string; questions: BonusQuestion[]
  teamsMap: Map<string, Team>; tipsMap: Map<string, string[]>; answersMap: Map<string, string[] | null>
  myBonus: number; lng: 'de' | 'en'; t: TFn
}) {
  const correct = (qid: string, teamId: string) => answersMap.get(qid)?.includes(teamId) ?? false
  return (
    <section className="card pad stack" style={{ gap: 10, borderTop: '4px solid var(--purpur)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>{t('uebersicht.myBonusTitle')}</h3>
        <span className="badge purpur">{t('uebersicht.bonusPoints')}: {myBonus}</span>
      </div>
      <div className="bonus-grid">
        {questions.map((q) => {
          const picks = (me && tipsMap.get(`${me}|${q.id}`)) || []
          const wide = q.category === 'semifinalists'
          return (
            <div className={`bonus-item${wide ? ' wide' : ''}`} key={q.id}>
              <span className="lbl">{bonusLabel(q, t)}</span>
              <div className="picks">
                {picks.length === 0
                  ? <span className="muted">{t('common.none')}</span>
                  : picks.map((pid) => (
                    <span key={pid} className="team-chip" title={teamsMap.get(pid)?.name ?? pid}>
                      <Flag team={teamsMap.get(pid)} />
                      <span className="nm">{teamName(teamsMap.get(pid), lng)}</span>
                      {correct(q.id, pid) && <span className="check-ok" title={t('uebersicht.correct')}>✓</span>}
                    </span>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Detailtabelle: alle Teilnehmer × Bonusfragen (TLA bzw. Flaggen, ✓/grüner Rahmen bei korrekt). */
function AllBonusTable({ rows, me, questions, teamsMap, tipsMap, answersMap, totalsMap, t }: {
  rows: Profile[]; me?: string; questions: BonusQuestion[]
  teamsMap: Map<string, Team>; tipsMap: Map<string, string[]>; answersMap: Map<string, string[] | null>
  totalsMap: Map<string, UserTotals>; t: TFn
}) {
  const sorted = [...rows].sort((a, b) => (totalsMap.get(b.id)?.bonus_points ?? 0) - (totalsMap.get(a.id)?.bonus_points ?? 0) || a.display_name.localeCompare(b.display_name))
  const correct = (qid: string, teamId: string) => answersMap.get(qid)?.includes(teamId) ?? false
  return (
    <>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="table compact sticky" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th className="col-pos" style={{ width: 38 }}>{t('uebersicht.pos')}</th>
              <th>{t('uebersicht.name')}</th>
              {questions.map((q) => <th key={q.id} className="num" title={bonusLabel(q, t)}>{bonusShort(q, t)}</th>)}
              <th className="num" title={t('uebersicht.bTitle')} style={{ color: 'var(--purpur)' }}>{t('uebersicht.bShort')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.id} className={p.id === me ? 'me' : undefined} style={p.id === me ? { background: 'var(--cream)' } : undefined}>
                <td className="col-pos" style={{ color: 'var(--navy-300)', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>
                  {truncateName(p.display_name)}{p.id === me && <span className="badge petrol" style={{ marginLeft: 6 }}>{t('uebersicht.you')}</span>}
                </td>
                {questions.map((q) => (
                  <td key={q.id} className="num">
                    <BonusPick picks={tipsMap.get(`${p.id}|${q.id}`)} isSet={q.category === 'semifinalists'}
                      teamsMap={teamsMap} correct={(tid) => correct(q.id, tid)} />
                  </td>
                ))}
                <td className="num" style={{ color: 'var(--purpur)', fontWeight: 700 }}>{totalsMap.get(p.id)?.bonus_points ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: '.8rem' }}>{t('uebersicht.bonusHiddenHint')}</p>
    </>
  )
}

/** Eine Bonus-Zelle: TLA (Einzel) bzw. kleine Flaggen (Halbfinalisten); ✓ / grüner Rahmen bei korrekt. Bricht nicht um. */
function BonusPick({ picks, isSet, teamsMap, correct }: {
  picks?: string[]; isSet: boolean
  teamsMap: Map<string, Team>
  correct: (teamId: string) => boolean
}) {
  if (!picks || picks.length === 0) return <span style={{ color: 'var(--gray)' }}>–</span>
  if (isSet) {
    return (
      <span className="bonus-set">
        {picks.map((pid) => (
          <span key={pid} className={`fw${correct(pid) ? ' ok' : ''}`} title={teamsMap.get(pid)?.name ?? pid}>
            <Flag team={teamsMap.get(pid)} />
          </span>
        ))}
      </span>
    )
  }
  const pid = picks[0]
  return (
    <span className="bonus-cell" title={teamsMap.get(pid)?.name ?? pid}>
      <span style={{ fontFamily: 'var(--font-mono)' }}>{teamsMap.get(pid)?.tla ?? '—'}</span>
      {correct(pid) && <span className="check-ok">✓</span>}
    </span>
  )
}

function GroupBonusOverview({ rows, t }: {
  rows: GroupTotals[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
}) {
  const sorted = [...rows].sort((a, b) => Number(b.bonus_points) - Number(a.bonus_points) || a.name.localeCompare(b.name))
  return (
    <div className="panel" style={{ overflowX: 'auto' }}>
      <table className="table sticky" style={{ minWidth: 360 }}>
        <thead>
          <tr>
            <th className="col-pos" style={{ width: 38 }}>{t('uebersicht.pos')}</th>
            <th>{t('leaderboard.groupCol')}</th>
            <th className="num" style={{ color: 'var(--purpur)' }}>{t('uebersicht.bonusPoints')}</th>
            <th className="num">{t('uebersicht.gShort')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g, i) => (
            <tr key={g.group_id}>
              <td className="col-pos" style={{ color: 'var(--navy-300)', fontWeight: 700 }}>{i + 1}</td>
              <td style={{ fontWeight: 600 }}>{truncateName(g.name)}<span className="muted" style={{ marginLeft: 6, fontSize: '.8rem', fontWeight: 400 }}>· {g.member_count}</span></td>
              <td className="num" style={{ color: 'var(--purpur)', fontWeight: 700 }}>{fmtPts(g.bonus_points, '')}</td>
              <td className="num" style={{ fontWeight: 800 }}>{fmtPts(g.total, '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
