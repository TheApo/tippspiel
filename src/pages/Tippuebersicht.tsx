import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  fetchMatches, fetchTeams, fetchProfiles, fetchVisibleTips, fetchTipStatus,
  fetchMatchdayPoints, fetchUserTotals, fetchBonusStatus,
} from '../lib/queries'
import {
  STAGE_LABEL, type Match, type Team, type Profile, type Tip, type TipStatus,
  type MatchdayPoints, type UserTotals, type BonusStatus,
} from '../lib/types'
import { fmtDate, fmtTime, kickoffLocked, ptsClass } from '../lib/format'
import { matchdayLabel } from '../lib/matchday'
import { teamName } from '../lib/teamNames'
import { Flag } from '../components/Flag'

const TOTAL_BONUS_QUESTIONS = 15

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
  const [bonusStatus, setBonusStatus] = useState<BonusStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'md' | 'bonus'>('md')
  const [md, setMd] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetchMatches(), fetchTeams(), fetchProfiles(), fetchVisibleTips(), fetchTipStatus(),
      fetchMatchdayPoints(), fetchUserTotals(), fetchBonusStatus(),
    ]).then(([m, tm, pr, tp, st, mp, to, bs]) => {
      setMatches(m); setTeams(tm); setProfiles(pr); setTips(tp); setStatus(st)
      setMdPoints(mp); setTotals(to); setBonusStatus(bs)
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
  const bonusMap = useMemo(() => new Map(bonusStatus.map((b) => [b.user_id, b.answered])), [bonusStatus])
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

  function mdLabel(day: number): string {
    return matchdayLabel(matchesByMd.get(day) ?? [], day, lng)
  }

  if (loading) return <div className="skeleton" style={{ height: 360 }} />
  if (matchdays.length === 0) return <div className="card pad muted">{t('uebersicht.empty')}</div>

  const idx = md != null ? matchdays.indexOf(md) : 0
  const dayMatches = md != null ? (matchesByMd.get(md) ?? []) : []

  return (
    <div className="stack" style={{ gap: 18 }}>
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
        <BonusOverview rows={rows} me={me} totalsMap={totalsMap} bonusMap={bonusMap} t={t} />
      ) : (
        <>
          {/* Spielliste */}
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>{t('uebersicht.termin')}</th>
                  <th>{t('uebersicht.heim')}</th>
                  <th>{t('uebersicht.gast')}</th>
                  <th>{t('uebersicht.gruppe')}</th>
                  <th className="num">{t('uebersicht.ergebnis')}</th>
                </tr>
              </thead>
              <tbody>
                {dayMatches.map((m) => {
                  const home = teamsMap.get(m.home_team_id ?? ''); const away = teamsMap.get(m.away_team_id ?? '')
                  const fin = m.status === 'FINISHED' && m.full_home != null
                  const suffix = m.duration === 'PENALTY_SHOOTOUT' ? ' n.E.' : m.duration === 'EXTRA_TIME' ? ' n.V.' : ''
                  return (
                    <tr key={m.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(m.kickoff, lng)} {fmtTime(m.kickoff, lng)}</td>
                      <td><span className="row" style={{ gap: 8 }}><Flag team={home} /> {teamName(home, lng)}</span></td>
                      <td><span className="row" style={{ gap: 8 }}><Flag team={away} /> {teamName(away, lng)}</span></td>
                      <td className="muted">{m.group_letter ? `${t('common.group')} ${m.group_letter}` : STAGE_LABEL[m.stage][lng]}</td>
                      <td className="num" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fin ? `${m.full_home}:${m.full_away}${suffix}` : '-:-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Tipper-Kreuztabelle */}
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ width: 38 }}>{t('uebersicht.pos')}</th>
                  <th>{t('uebersicht.name')}</th>
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
                {rows.map((p, i) => {
                  const isMe = p.id === me
                  const tot = totalsMap.get(p.id)
                  const tr = trophies.get(p.id) ?? 0
                  return (
                    <tr key={p.id} style={isMe ? { background: 'var(--cream)' } : undefined}>
                      <td style={{ color: 'var(--navy-300)', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {currentWinners.has(p.id) && <span title={t('uebersicht.mdWinner')}>🏆 </span>}
                        {p.display_name}
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

function BonusOverview({ rows, me, totalsMap, bonusMap, t }: {
  rows: Profile[]; me?: string
  totalsMap: Map<string, UserTotals>; bonusMap: Map<string, number>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
}) {
  const sorted = [...rows].sort((a, b) => (totalsMap.get(b.id)?.bonus_points ?? 0) - (totalsMap.get(a.id)?.bonus_points ?? 0) || a.display_name.localeCompare(b.display_name))
  return (
    <div className="panel" style={{ overflowX: 'auto' }}>
      <table className="table" style={{ minWidth: 420 }}>
        <thead>
          <tr>
            <th style={{ width: 38 }}>{t('uebersicht.pos')}</th>
            <th>{t('uebersicht.name')}</th>
            <th className="num">{t('uebersicht.answered')}</th>
            <th className="num" style={{ color: 'var(--purpur)' }}>{t('uebersicht.bonusPoints')}</th>
            <th className="num">{t('uebersicht.gShort')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const tot = totalsMap.get(p.id)
            return (
              <tr key={p.id} style={p.id === me ? { background: 'var(--cream)' } : undefined}>
                <td style={{ color: 'var(--navy-300)', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{p.display_name}{p.id === me && <span className="badge petrol" style={{ marginLeft: 6 }}>{t('uebersicht.you')}</span>}</td>
                <td className="num">{bonusMap.get(p.id) ?? 0}/{TOTAL_BONUS_QUESTIONS}</td>
                <td className="num" style={{ color: 'var(--purpur)', fontWeight: 700 }}>{tot?.bonus_points ?? 0}</td>
                <td className="num" style={{ fontWeight: 800 }}>{tot?.total ?? 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
