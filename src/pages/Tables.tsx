import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchMatches, fetchTeams } from '../lib/queries'
import type { Match, Team } from '../lib/types'
import { teamName } from '../lib/teamNames'
import { Flag } from '../components/Flag'

interface Row {
  team: Team; pld: number; w: number; d: number; l: number; gf: number; ga: number; pts: number
}

function standings(teams: Team[], matches: Match[]): Row[] {
  const rows = new Map<string, Row>()
  for (const team of teams) rows.set(team.id, { team, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })
  for (const m of matches) {
    if (m.stage !== 'GROUP' || m.status !== 'FINISHED' || m.full_home == null || m.full_away == null) continue
    const h = rows.get(m.home_team_id ?? ''); const a = rows.get(m.away_team_id ?? '')
    if (!h || !a) continue
    h.pld++; a.pld++; h.gf += m.full_home; h.ga += m.full_away; a.gf += m.full_away; a.ga += m.full_home
    if (m.full_home > m.full_away) { h.w++; h.pts += 3; a.l++ }
    else if (m.full_home < m.full_away) { a.w++; a.pts += 3; h.l++ }
    else { h.d++; a.d++; h.pts++; a.pts++ }
  }
  return [...rows.values()].sort(
    (x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.team.name.localeCompare(y.team.name),
  )
}

export default function Tables() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'de'
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchMatches(), fetchTeams()])
      .then(([m, tm]) => { setMatches(m); setTeams(tm) })
      .finally(() => setLoading(false))
  }, [])

  const groups = useMemo(() => {
    const byGroup: Record<string, Team[]> = {}
    for (const team of teams) if (team.group_letter) (byGroup[team.group_letter] ??= []).push(team)
    return Object.keys(byGroup).sort().map((g) => ({ g, rows: standings(byGroup[g], matches) }))
  }, [teams, matches])

  if (loading) return <div className="skeleton" style={{ height: 320 }} />

  return (
    <div className="stack" style={{ gap: 16 }}>
      <header>
        <span className="eyebrow">{t('nav.tables')}</span>
        <h1>{t('tables.title')}</h1>
        <p className="muted">{t('tables.subtitle')}</p>
      </header>

      {groups.length === 0 ? (
        <div className="card pad muted">{t('tables.empty')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 18 }}>
          {groups.map(({ g, rows }) => (
            <section key={g} className="panel">
              <div className="panel-head"><span className="badge cream">{t('common.group')} {g}</span></div>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>{t('tables.pos')}</th>
                    <th>{t('tables.team')}</th>
                    <th className="num">{t('tables.pld')}</th>
                    <th className="num">{t('tables.gd')}</th>
                    <th className="num">{t('tables.pts')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.team.id}>
                      <td style={{ color: i < 2 ? 'var(--petrol)' : 'var(--gray)', fontWeight: 700 }}>{i + 1}</td>
                      <td><span className="row" style={{ gap: 8 }}><Flag team={r.team} /> {teamName(r.team, lng)}</span></td>
                      <td className="num">{r.pld}</td>
                      <td className="num">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
                      <td className="num" style={{ fontWeight: 800 }}>{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
