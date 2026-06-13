import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchMatches, fetchTeams } from '../lib/queries'
import type { Match, Team } from '../lib/types'
import { teamName } from '../lib/teamNames'
import { isLive, inLiveWindow } from '../lib/live'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { Flag } from '../components/Flag'

interface Row {
  team: Team; pld: number; w: number; d: number; l: number; gf: number; ga: number; pts: number
}

function standings(teams: Team[], matches: Match[]): Row[] {
  const rows = new Map<string, Row>()
  for (const team of teams) rows.set(team.id, { team, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })
  for (const m of matches) {
    if (m.stage !== 'GROUP') continue
    // Gewertet wird der Endstand (beendet) bzw. der aktuelle Live-Zwischenstand.
    let hg: number, ag: number
    if (m.status === 'FINISHED' && m.full_home != null && m.full_away != null) {
      hg = m.full_home; ag = m.full_away
    } else if (isLive(m)) {
      hg = m.live_home as number; ag = m.live_away as number
    } else continue
    const h = rows.get(m.home_team_id ?? ''); const a = rows.get(m.away_team_id ?? '')
    if (!h || !a) continue
    h.pld++; a.pld++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg
    if (hg > ag) { h.w++; h.pts += 3; a.l++ }
    else if (hg < ag) { a.w++; a.pts += 3; h.l++ }
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

  async function reload() {
    const [m, tm] = await Promise.all([fetchMatches(), fetchTeams()])
    setMatches(m); setTeams(tm)
  }
  useEffect(() => {
    void (async () => { try { await reload() } finally { setLoading(false) } })()
  }, [])

  // Laufende Gruppenspiele fließen als Live-Zwischenstand in die Tabelle ein
  // (Tore/Punkte/Platz aktualisieren sich live; betroffene Werte petrol markiert).
  const liveMatches = useMemo(() => matches.filter(isLive), [matches])
  useLiveRefresh(() => matches.some((m) => inLiveWindow(m)), reload)
  const liveByTeam = useMemo(() => {
    const map = new Map<string, Match>()
    for (const m of liveMatches) {
      if (m.home_team_id) map.set(m.home_team_id, m)
      if (m.away_team_id) map.set(m.away_team_id, m)
    }
    return map
  }, [liveMatches])

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
                  {rows.map((r, i) => {
                    const lm = liveByTeam.get(r.team.id)
                    const isHome = lm?.home_team_id === r.team.id
                    const live = !!lm
                    const liveStyle = live ? { color: 'var(--petrol)' } : undefined
                    const liveHint = live ? t('common.liveProvisional') : undefined
                    return (
                    <tr key={r.team.id}>
                      <td style={{ color: i < 2 ? 'var(--petrol)' : 'var(--gray)', fontWeight: 700 }}>{i + 1}</td>
                      <td>
                        <span className="row" style={{ gap: 8 }}>
                          <Flag team={r.team} /> {teamName(r.team, lng)}
                          {lm && <span className="badge live" title={t('common.live')}>{t('common.live')} {isHome ? lm.live_home : lm.live_away}:{isHome ? lm.live_away : lm.live_home}</span>}
                        </span>
                      </td>
                      <td className="num" style={liveStyle} title={liveHint}>{r.pld}</td>
                      <td className="num" style={liveStyle} title={liveHint}>{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
                      <td className="num" style={{ fontWeight: 800, ...(live ? { color: 'var(--petrol)' } : {}) }} title={liveHint}>{r.pts}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
