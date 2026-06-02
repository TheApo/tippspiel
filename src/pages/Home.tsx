import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { fetchMatches, fetchTeams, fetchSettings, fetchUserTotals } from '../lib/queries'
import type { Match, Team, AppSettings, UserTotals } from '../lib/types'
import { fmtDateTime, kickoffLocked } from '../lib/format'
import { teamName } from '../lib/teamNames'
import { Flag } from '../components/Flag'

export default function Home() {
  const { t, i18n } = useTranslation()
  const { session, profile } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [totals, setTotals] = useState<UserTotals[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchMatches(), fetchTeams(), fetchSettings(), fetchUserTotals()])
      .then(([m, tm, s, tot]) => { setMatches(m); setTeams(tm); setSettings(s); setTotals(tot) })
      .finally(() => setLoading(false))
  }, [])

  const teamsMap = useMemo(() => new Map(teams.map((x) => [x.id, x])), [teams])
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
          <span className="eyebrow" style={{ color: 'var(--petrol)' }}>{t('home.hello', { name: profile?.display_name ?? '' })}</span>
          <h1 style={{ color: 'var(--white)', margin: '8px 0 12px' }}>{t('home.heroTitle')}</h1>
          <p style={{ color: 'var(--cream)', fontSize: '1.05rem' }}>{t('home.heroText')}</p>
          <div className="row wrap" style={{ marginTop: 20, gap: 10 }}>
            <Link to="/tippen" className="btn accent">{t('home.ctaTip')}</Link>
            <Link to="/regeln" className="btn ghost" style={{ color: 'var(--cream)', borderColor: 'rgba(255,255,255,.3)' }}>{t('home.ctaRules')}</Link>
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
          ) : next.length === 0 ? (
            <div className="card pad muted" style={{ border: 0, boxShadow: 'none' }}>{t('home.noData')}</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {next.map((m) => (
                <li key={m.id} className="row" style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', gap: 12 }}>
                  <span className="badge cream" style={{ minWidth: 64, justifyContent: 'center' }}>{t('common.matchday')} {m.matchday}</span>
                  <span className="row" style={{ gap: 8, flex: 1, justifyContent: 'flex-end' }}><strong style={{ fontWeight: 600 }}>{teamName(teamsMap.get(m.home_team_id!), lng)}</strong><Flag team={teamsMap.get(m.home_team_id!)} /></span>
                  <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>:</span>
                  <span className="row" style={{ gap: 8, flex: 1 }}><Flag team={teamsMap.get(m.away_team_id!)} /><strong style={{ fontWeight: 600 }}>{teamName(teamsMap.get(m.away_team_id!), lng)}</strong></span>
                  <span className="muted" style={{ fontSize: '.8rem', minWidth: 120, textAlign: 'right' }}>{fmtDateTime(m.kickoff, lng)}</span>
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
                  <strong style={{ flex: 1, fontWeight: 600 }}>{u.display_name}</strong>
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
