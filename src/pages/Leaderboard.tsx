import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  fetchUserTotals, fetchMatchdayPoints, fetchMatches,
  fetchGroupTotals, fetchGroupMatchdayPoints,
} from '../lib/queries'
import type { UserTotals, MatchdayPoints, Match, GroupTotals, GroupMatchdayPoints } from '../lib/types'
import { matchdayShort } from '../lib/matchday'
import { truncateName, fmtPts } from '../lib/format'

const MIN_GROUP = 2

export default function Leaderboard() {
  const { t } = useTranslation()
  const { session, profile } = useAuth()
  const [totals, setTotals] = useState<UserTotals[]>([])
  const [mdPoints, setMdPoints] = useState<MatchdayPoints[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [groupTotals, setGroupTotals] = useState<GroupTotals[]>([])
  const [groupMd, setGroupMd] = useState<GroupMatchdayPoints[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'solo' | 'group'>('solo')

  useEffect(() => {
    Promise.all([
      fetchUserTotals(), fetchMatchdayPoints(), fetchMatches(),
      fetchGroupTotals(), fetchGroupMatchdayPoints(),
    ])
      .then(([a, b, c, d, e]) => { setTotals(a); setMdPoints(b); setMatches(c); setGroupTotals(d); setGroupMd(e) })
      .finally(() => setLoading(false))
  }, [])

  const matchdays = useMemo(() => {
    const set = new Set<number>([
      ...matches.map((m) => m.matchday),
      ...mdPoints.map((p) => p.matchday),
      ...groupMd.map((p) => p.matchday),
    ])
    return [...set].sort((a, b) => a - b)
  }, [matches, mdPoints, groupMd])

  // points[user][md] und points[group][md]
  const soloGrid = useMemo(() => {
    const g = new Map<string, Map<number, number>>()
    for (const p of mdPoints) { if (!g.has(p.user_id)) g.set(p.user_id, new Map()); g.get(p.user_id)!.set(p.matchday, p.points) }
    return g
  }, [mdPoints])
  const groupGrid = useMemo(() => {
    const g = new Map<string, Map<number, number>>()
    for (const p of groupMd) { if (!g.has(p.group_id)) g.set(p.group_id, new Map()); g.get(p.group_id)!.set(p.matchday, Number(p.points)) }
    return g
  }, [groupMd])

  function mdLabel(md: number): string {
    return matchdayShort(matches.filter((m) => m.matchday === md), md)
  }

  // Angemeldeten Account immer zeigen (auch mit 0 Punkten)
  const soloRows = useMemo(() => {
    if (!session || totals.some((u) => u.user_id === session.user.id)) return totals
    return [...totals, {
      user_id: session.user.id, display_name: profile?.display_name ?? t('leaderboard.you'),
      match_points: 0, bonus_points: 0, total: 0, exact_hits: 0,
    }]
  }, [totals, session, profile, t])

  const groupRows = useMemo(() =>
    groupTotals
      .filter((g) => g.member_count >= MIN_GROUP)
      .sort((a, b) => Number(b.total) - Number(a.total) || a.name.localeCompare(b.name)),
  [groupTotals])

  if (loading) return <div className="skeleton" style={{ height: 320 }} />

  const isGroup = tab === 'group'

  return (
    <div className="stack" style={{ gap: 16 }}>
      <header>
        <span className="eyebrow">{t('nav.leaderboard')}</span>
        <h1>{t('leaderboard.title')}</h1>
        <p className="muted">{t('leaderboard.subtitle')}</p>
      </header>

      {/* Einzel- / Gruppenwertung */}
      <div className="seg" role="tablist">
        <button role="tab" className={!isGroup ? 'on' : ''} onClick={() => setTab('solo')}>{t('common.solo')}</button>
        <button role="tab" className={isGroup ? 'on' : ''} onClick={() => setTab('group')}>{t('common.groups')}</button>
      </div>

      {isGroup && groupRows.length === 0 ? (
        <div className="card pad muted">{t('leaderboard.emptyGroups')}</div>
      ) : !isGroup && soloRows.length === 0 ? (
        <div className="card pad muted">{t('leaderboard.empty')}</div>
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>{t('leaderboard.rank')}</th>
                <th>{isGroup ? t('leaderboard.groupCol') : t('leaderboard.player')}</th>
                {matchdays.map((md) => (
                  <th key={md} className="num" title={`${t('common.matchday')} ${md}`}>{mdLabel(md)}</th>
                ))}
                <th className="num" style={{ color: 'var(--purpur)' }}>{t('common.bonus')}</th>
                <th className="num" style={{ color: 'var(--navy)' }}>{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {isGroup
                ? groupRows.map((g, i) => {
                  const row = groupGrid.get(g.group_id)
                  return (
                    <tr key={g.group_id}>
                      <td><RankPill i={i} /></td>
                      <td style={{ fontWeight: 600 }}>
                        {truncateName(g.name)}
                        <span className="muted" style={{ marginLeft: 8, fontSize: '.8rem', fontWeight: 400 }}>· {g.member_count}</span>
                      </td>
                      {matchdays.map((md) => {
                        const p = row?.get(md)
                        return <td key={md} className="num" style={{ color: p ? 'var(--ink)' : 'var(--gray)' }}>{p ? fmtPts(p, '') : '·'}</td>
                      })}
                      <td className="num" style={{ color: 'var(--purpur)', fontWeight: 700 }}>{Number(g.bonus_points) ? fmtPts(g.bonus_points, '') : '·'}</td>
                      <td className="num" style={{ fontWeight: 800, fontSize: '1.05rem' }}>{fmtPts(g.total, '')}</td>
                    </tr>
                  )
                })
                : soloRows.map((u, i) => {
                  const isMe = u.user_id === session?.user.id
                  const row = soloGrid.get(u.user_id)
                  return (
                    <tr key={u.user_id} style={isMe ? { background: 'var(--lilac)' } : undefined}>
                      <td><RankPill i={i} /></td>
                      <td style={{ fontWeight: 600 }}>
                        {truncateName(u.display_name)}{isMe && <span className="badge petrol" style={{ marginLeft: 8 }}>{t('leaderboard.you')}</span>}
                      </td>
                      {matchdays.map((md) => {
                        const p = row?.get(md)
                        return <td key={md} className="num" style={{ color: p ? 'var(--ink)' : 'var(--gray)' }}>{p ?? '·'}</td>
                      })}
                      <td className="num" style={{ color: 'var(--purpur)', fontWeight: 700 }}>{u.bonus_points || '·'}</td>
                      <td className="num" style={{ fontWeight: 800, fontSize: '1.05rem' }}>{u.total}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RankPill({ i }: { i: number }) {
  return (
    <span className="tag-rule" style={{ background: i === 0 ? 'var(--purpur)' : 'transparent', color: i === 0 ? '#fff' : 'var(--navy-300)', fontSize: '.85rem' }}>{i + 1}</span>
  )
}
