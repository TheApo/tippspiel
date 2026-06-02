import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { fetchUserTotals, fetchMatchdayPoints, fetchMatches } from '../lib/queries'
import type { UserTotals, MatchdayPoints, Match } from '../lib/types'
import { matchdayShort } from '../lib/matchday'

export default function Leaderboard() {
  const { t } = useTranslation()
  const { session, profile } = useAuth()
  const [totals, setTotals] = useState<UserTotals[]>([])
  const [mdPoints, setMdPoints] = useState<MatchdayPoints[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchUserTotals(), fetchMatchdayPoints(), fetchMatches()])
      .then(([a, b, c]) => { setTotals(a); setMdPoints(b); setMatches(c) })
      .finally(() => setLoading(false))
  }, [])

  const matchdays = useMemo(() => {
    const set = new Set<number>([...matches.map((m) => m.matchday), ...mdPoints.map((p) => p.matchday)])
    return [...set].sort((a, b) => a - b)
  }, [matches, mdPoints])

  // points[user][md]
  const grid = useMemo(() => {
    const g = new Map<string, Map<number, number>>()
    for (const p of mdPoints) {
      if (!g.has(p.user_id)) g.set(p.user_id, new Map())
      g.get(p.user_id)!.set(p.matchday, p.points)
    }
    return g
  }, [mdPoints])

  function mdLabel(md: number): string {
    return matchdayShort(matches.filter((m) => m.matchday === md), md)
  }

  // Angemeldeten Account immer zeigen — auch mit 0 Punkten
  const rows = useMemo(() => {
    if (!session || totals.some((u) => u.user_id === session.user.id)) return totals
    return [...totals, {
      user_id: session.user.id, display_name: profile?.display_name ?? t('leaderboard.you'),
      match_points: 0, bonus_points: 0, total: 0, exact_hits: 0,
    }]
  }, [totals, session, profile, t])

  if (loading) return <div className="skeleton" style={{ height: 320 }} />

  return (
    <div className="stack" style={{ gap: 16 }}>
      <header>
        <span className="eyebrow">{t('nav.leaderboard')}</span>
        <h1>{t('leaderboard.title')}</h1>
        <p className="muted">{t('leaderboard.subtitle')}</p>
      </header>

      {rows.length === 0 ? (
        <div className="card pad muted">{t('leaderboard.empty')}</div>
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>{t('leaderboard.rank')}</th>
                <th>{t('leaderboard.player')}</th>
                {matchdays.map((md) => (
                  <th key={md} className="num" title={`${t('common.matchday')} ${md}`}>{mdLabel(md)}</th>
                ))}
                <th className="num" style={{ color: 'var(--purpur)' }}>{t('common.bonus')}</th>
                <th className="num" style={{ color: 'var(--navy)' }}>{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u, i) => {
                const isMe = u.user_id === session?.user.id
                const row = grid.get(u.user_id)
                return (
                  <tr key={u.user_id} style={isMe ? { background: 'var(--lilac)' } : undefined}>
                    <td>
                      <span className="tag-rule" style={{ background: i === 0 ? 'var(--purpur)' : 'transparent', color: i === 0 ? '#fff' : 'var(--navy-300)', fontSize: '.85rem' }}>{i + 1}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {u.display_name}{isMe && <span className="badge petrol" style={{ marginLeft: 8 }}>{t('leaderboard.you')}</span>}
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
