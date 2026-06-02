import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchMatches, fetchTeams, fetchProfiles } from '../lib/queries'
import type { Match, Team, Duration, Profile } from '../lib/types'
import { fmtDate } from '../lib/format'

export default function Admin() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'de'
  const { profile } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Manuelles Ergebnis
  const [matchId, setMatchId] = useState('')
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [duration, setDuration] = useState<Duration>('REGULAR')

  useEffect(() => {
    Promise.all([fetchMatches(), fetchTeams(), fetchProfiles()]).then(([m, tm, pr]) => { setMatches(m); setTeams(tm); setProfiles(pr) })
  }, [])
  const teamsMap = useMemo(() => new Map(teams.map((x) => [x.id, x])), [teams])

  if (!profile?.is_admin) {
    return <div className="card pad muted">{t('admin.onlyAdmin')}</div>
  }

  async function runSync() {
    setBusy(true); setErr(''); setMsg('')
    try {
      const { error } = await supabase.functions.invoke('sync', { body: { action: 'sync' } })
      if (error) throw error
      setMsg(t('admin.syncDone'))
      const m = await fetchMatches(); setMatches(m)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  async function runOdds() {
    setBusy(true); setErr(''); setMsg('')
    try {
      const { error } = await supabase.functions.invoke('sync', { body: { action: 'odds' } })
      if (error) throw error
      setMsg(t('admin.syncDone'))
      const m = await fetchMatches(); setMatches(m)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  async function setResult() {
    if (!matchId || home === '' || away === '') return
    const h = Number(home); const a = Number(away)
    const winner = h > a ? 'HOME_TEAM' : h < a ? 'AWAY_TEAM' : 'DRAW'
    setBusy(true); setErr(''); setMsg('')
    try {
      const { error } = await supabase.functions.invoke('sync', {
        body: { action: 'set_result', match_id: Number(matchId), full_home: h, full_away: a, duration, winner },
      })
      if (error) throw error
      setMsg(t('admin.syncDone'))
      const m = await fetchMatches(); setMatches(m)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  async function kick(p: Profile) {
    if (!window.confirm(t('admin.removeConfirm', { name: p.display_name }))) return
    setBusy(true); setErr(''); setMsg('')
    try {
      const { error } = await supabase.functions.invoke('sync', { body: { action: 'delete_user', user_id: p.id } })
      if (error) throw error
      setProfiles(await fetchProfiles())
      setMsg(t('admin.removed'))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 720 }}>
      <header>
        <span className="eyebrow">{t('nav.admin')}</span>
        <h1>{t('admin.title')}</h1>
      </header>

      <section className="card pad" style={{ borderTop: '4px solid var(--petrol)' }}>
        <h3>{t('admin.sync')}</h3>
        <p className="muted">{t('admin.syncHint')}</p>
        <button className="btn petrol" disabled={busy} onClick={runSync}>{busy ? t('admin.syncing') : t('admin.sync')}</button>
        <hr className="divider" style={{ margin: '16px 0' }} />
        <p className="muted">{t('admin.syncOddsHint')}</p>
        <button className="btn ghost" disabled={busy} onClick={runOdds}>{t('admin.syncOdds')}</button>
      </section>

      <section className="card pad" style={{ borderTop: '4px solid var(--purpur)' }}>
        <h3>{t('admin.manualTitle')}</h3>
        <div className="stack" style={{ marginTop: 10 }}>
          <label className="field">
            {t('common.matchday')}
            <select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">—</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  ST{m.matchday} · {teamsMap.get(m.home_team_id ?? '')?.name ?? '?'} – {teamsMap.get(m.away_team_id ?? '')?.name ?? '?'}
                </option>
              ))}
            </select>
          </label>
          <div className="row" style={{ gap: 10 }}>
            <label className="field" style={{ flex: 1 }}>{t('tippen.result')}
              <div className="row" style={{ gap: 6 }}>
                <input className="score-input" inputMode="numeric" value={home} onChange={(e) => setHome(e.target.value.replace(/[^0-9]/g, ''))} />
                <span className="muted">:</span>
                <input className="score-input" inputMode="numeric" value={away} onChange={(e) => setAway(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
            </label>
            <label className="field" style={{ flex: 1 }}>Modus
              <select value={duration} onChange={(e) => setDuration(e.target.value as Duration)}>
                <option value="REGULAR">90 Min</option>
                <option value="EXTRA_TIME">n. Verlängerung</option>
                <option value="PENALTY_SHOOTOUT">Elfmeterschießen</option>
              </select>
            </label>
          </div>
          <button className="btn accent" disabled={busy || !matchId} onClick={setResult}>{t('admin.recompute')}</button>
        </div>
      </section>

      <section className="card pad" style={{ borderTop: '4px solid var(--navy)' }}>
        <h3>{t('admin.participants')} ({profiles.length})</h3>
        <div className="panel" style={{ marginTop: 10, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr><th>{t('uebersicht.name')}</th><th>E-Mail</th><th>{t('admin.created')}</th><th></th></tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.display_name}{p.is_admin && <span className="badge purpur" style={{ marginLeft: 6 }}>Admin</span>}</td>
                  <td className="muted">{p.email}</td>
                  <td className="muted">{p.created_at ? fmtDate(p.created_at, lng) : '—'}</td>
                  <td className="num">
                    {p.id !== profile?.id && (
                      <button className="btn ghost sm" style={{ color: 'var(--purpur)', borderColor: 'var(--purpur)' }} disabled={busy} onClick={() => kick(p)}>
                        {t('admin.remove')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: '.78rem', marginTop: 8 }}>{t('admin.needsFunction')}</p>
      </section>

      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert err">{err}</div>}
    </div>
  )
}
