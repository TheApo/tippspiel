import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { fetchMatches, fetchTeams, fetchSettings, fetchUserTotals } from '../lib/queries'
import type { Match, Team, AppSettings, UserTotals } from '../lib/types'
import { fmtDateTime, kickoffLocked, truncateName } from '../lib/format'
import { teamName } from '../lib/teamNames'
import { isLive } from '../lib/live'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { Flag } from '../components/Flag'

export default function Home() {
  const { t, i18n } = useTranslation()
  const { session, profile } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [totals, setTotals] = useState<UserTotals[]>([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    const [m, tm, s, tot] = await Promise.all([fetchMatches(), fetchTeams(), fetchSettings(), fetchUserTotals()])
    setMatches(m); setTeams(tm); setSettings(s); setTotals(tot)
  }
  useEffect(() => {
    void (async () => { try { await reload() } finally { setLoading(false) } })()
  }, [])

  const teamsMap = useMemo(() => new Map(teams.map((x) => [x.id, x])), [teams])
  const liveMatches = useMemo(() => matches.filter(isLive), [matches])
  useLiveRefresh(liveMatches.length > 0, reload)
  const next = useMemo(
    () => matches.filter((m) => !kickoffLocked(m.kickoff) && m.home_team_id && m.away_team_id).slice(0, 5),
    [matches],
  )
  const myIdx = totals.findIndex((u) => u.user_id === session?.user.id)
  const me = myIdx >= 0 ? totals[myIdx] : null
  const top3 = totals.slice(0, 3)
  const bonusOpen = !settings?.bonus_deadline || !kickoffLocked(settings.bonus_deadline)
  const lng = i18n.resolvedLanguage ?? 'de'

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* Hero */}
      <section
        className="card"
        style={{
          background: 'var(--navy)', color: 'var(--white)', padding: 'clamp(24px,4vw,44px)',
          position: 'relative', overflow: 'hidden', border: 0,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div style={{ position: 'relative', maxWidth: 640 }}>
          <span className="eyebrow" style={{ color: 'var(--petrol)' }}>{t('home.hello', { name: truncateName(profile?.display_name) })}</span>
          <h1 style={{ color: 'var(--white)', margin: '8px 0 12px' }}>{t('home.heroTitle')}</h1>
          <p style={{ color: 'var(--cream)', fontSize: '1.05rem' }}>{t('home.heroText')}</p>
          <div className="row wrap" style={{ marginTop: 20, gap: 10 }}>
            <Link to="/tippen" className="btn accent">{t('home.ctaTip')}</Link>
            <Link to="/regeln" className="btn ghost-light">{t('home.ctaRules')}</Link>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <div className="row wrap" style={{ gap: 16, alignItems: 'stretch' }}>
        <StatCard label={t('home.yourRank')} value={me ? `#${myIdx + 1}` : '—'} accent />
        <StatCard label={t('home.yourPoints')} value={me ? String(me.total) : '0'} />
        <StatCard
          label={t('common.bonus')}
          value={bonusOpen ? t('common.open') : t('common.locked')}
          hint={bonusOpen ? t('home.bonusOpen') : t('home.bonusClosed')}
        />
      </div>

      <div className="row wrap" style={{ gap: 22, alignItems: 'flex-start' }}>
        {/* Next matches */}
        <section className="panel" style={{ flex: '2 1 420px' }}>
          <div className="panel-head"><h3>{t('home.nextMatches')}</h3></div>
          {loading ? (
            <div className="card pad" style={{ border: 0, boxShadow: 'none' }}><div className="skeleton" style={{ height: 56 }} /></div>
          ) : next.length === 0 && liveMatches.length === 0 ? (
            <div className="card pad muted" style={{ border: 0, boxShadow: 'none' }}>{t('home.noData')}</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {liveMatches.map((m) => (
                <li key={m.id} className="next-match">
                  <div className="nm-top">
                    <span className="badge live">{t('common.live')}</span>
                    <span className="live-score">{m.live_home}:{m.live_away}<span className="live-dot" style={{ marginLeft: 5 }} /></span>
                  </div>
                  <div className="nm-teams">
                    <span className="t home"><span className="nm">{teamName(teamsMap.get(m.home_team_id!), lng)}</span><Flag team={teamsMap.get(m.home_team_id!)} /></span>
                    <span className="sep">:</span>
                    <span className="t away"><Flag team={teamsMap.get(m.away_team_id!)} /><span className="nm">{teamName(teamsMap.get(m.away_team_id!), lng)}</span></span>
                  </div>
                </li>
              ))}
              {next.map((m) => (
                <li key={m.id} className="next-match">
                  <div className="nm-top">
                    <span className="badge cream">{t('common.matchday')} {m.matchday}</span>
                    <span className="muted nm-date">{fmtDateTime(m.kickoff, lng)}</span>
                  </div>
                  <div className="nm-teams">
                    <span className="t home"><span className="nm">{teamName(teamsMap.get(m.home_team_id!), lng)}</span><Flag team={teamsMap.get(m.home_team_id!)} /></span>
                    <span className="sep">:</span>
                    <span className="t away"><Flag team={teamsMap.get(m.away_team_id!)} /><span className="nm">{teamName(teamsMap.get(m.away_team_id!), lng)}</span></span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top 3 */}
        <section className="panel" style={{ flex: '1 1 260px' }}>
          <div className="panel-head"><h3>{t('home.top3')}</h3><span className="spacer" /><Link to="/gesamtliste" className="badge petrol">{t('nav.leaderboard')}</Link></div>
          {top3.length === 0 ? (
            <div className="card pad muted" style={{ border: 0, boxShadow: 'none' }}>{t('leaderboard.empty')}</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {top3.map((u, i) => (
                <li key={u.user_id} className="row" style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', gap: 12 }}>
                  <span className="tag-rule" style={{ background: i === 0 ? 'var(--purpur)' : 'var(--lilac)', color: i === 0 ? '#fff' : 'var(--navy)' }}>{i + 1}</span>
                  <strong style={{ flex: 1, fontWeight: 600 }}>{truncateName(u.display_name)}</strong>
                  <span className="pts p2" style={{ fontSize: '1.1rem' }}>{u.total}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card pad" style={{ flex: '1 1 200px', borderTop: `4px solid ${accent ? 'var(--purpur)' : 'var(--petrol)'}` }}>
      <span className="eyebrow">{label}</span>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2.4rem', color: 'var(--navy)', lineHeight: 1.1 }}>{value}</div>
      {hint && <span className="muted" style={{ fontSize: '.8rem' }}>{hint}</span>}
    </div>
  )
}
