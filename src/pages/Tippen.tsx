import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useUnsaved } from '../context/UnsavedContext'
import { fetchMatches, fetchTeams, fetchMyTips, saveTip } from '../lib/queries'
import type { Match, Team, Tip } from '../lib/types'
import { fmtDate, fmtTime, kickoffLocked, ptsClass } from '../lib/format'
import { matchdayLabel, matchLabel } from '../lib/matchday'
import { impliedProbs } from '../lib/odds'
import { teamName } from '../lib/teamNames'
import { Flag } from '../components/Flag'
import ConfirmDialog from '../components/ConfirmDialog'

type Draft = Record<number, { home: string; away: string }>

export default function Tippen() {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const lng = i18n.resolvedLanguage ?? 'de'

  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [tips, setTips] = useState<Tip[]>([])
  const [draft, setDraft] = useState<Draft>({})
  const [md, setMd] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    const [m, tm, tp] = await Promise.all([
      fetchMatches(), fetchTeams(), session ? fetchMyTips(session.user.id) : Promise.resolve([]),
    ])
    setMatches(m); setTeams(tm); setTips(tp)
    const d: Draft = {}
    for (const x of tp) d[x.match_id] = { home: String(x.home), away: String(x.away) }
    setDraft(d)
  }

  useEffect(() => {
    void (async () => { try { await load() } finally { setLoading(false) } })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const teamsMap = useMemo(() => new Map(teams.map((x) => [x.id, x])), [teams])
  const tipsMap = useMemo(() => new Map(tips.map((x) => [x.match_id, x])), [tips])

  const matchdays = useMemo(
    () => [...new Set(matches.map((m) => m.matchday))].sort((a, b) => a - b),
    [matches],
  )

  // Default-Spieltag: erster mit offenen Spielen — abgeleitet statt per Effekt gesetzt.
  const defaultMd = useMemo(() => {
    if (matchdays.length === 0) return null
    const open = matchdays.find((d) => matches.some((m) => m.matchday === d && !kickoffLocked(m.kickoff)))
    return open ?? matchdays[0]
  }, [matchdays, matches])
  const activeMd = md ?? defaultMd

  function mdLabel(day: number): string {
    return matchdayLabel(matches.filter((m) => m.matchday === day), day, lng)
  }

  const dayMatches = useMemo(
    () => matches.filter((m) => m.matchday === activeMd),
    [matches, activeMd],
  )

  // Offene, geänderte Tipps des aktuellen Spieltags (= ungespeicherte Tipps).
  const dayJobs = useMemo(
    () => dayMatches
      .filter((m) => !kickoffLocked(m.kickoff))
      .map((m) => ({ m, d: draft[m.id] }))
      .filter(({ d }) => d && d.home !== '' && d.away !== '')
      .filter(({ m, d }) => { const cur = tipsMap.get(m.id); return !cur || cur.home !== Number(d!.home) || cur.away !== Number(d!.away) })
      .map(({ m, d }) => ({ m, home: Number(d!.home), away: Number(d!.away) })),
    [dayMatches, draft, tipsMap],
  )
  const dirty = dayJobs.length > 0

  // Tipp-Warnung beim Seitenwechsel (Router) — über den UnsavedGuard im Layout.
  const { setDirty, registerSave } = useUnsaved()
  useEffect(() => { setDirty(dirty) }, [dirty, setDirty])
  useEffect(() => () => setDirty(false), [setDirty])
  // jeweils aktuelle Save-Closure registrieren (für den Guard)
  useEffect(() => { registerSave(() => persist(dayJobs)) })

  // Tab schließen / neu laden warnt zusätzlich nativ
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  // Spieltagswechsel: bei ungespeicherten Tipps erst nachfragen
  const [pendingMd, setPendingMd] = useState<number | null>(null)
  function requestMd(target: number) {
    if (target === activeMd) return
    if (dirty) setPendingMd(target)
    else setMd(target)
  }
  function revertDay() {
    setDraft((d) => {
      const next = { ...d }
      for (const m of dayMatches) {
        const cur = tipsMap.get(m.id)
        if (cur) next[m.id] = { home: String(cur.home), away: String(cur.away) }
        else delete next[m.id]
      }
      return next
    })
  }

  function setScore(id: number, side: 'home' | 'away', v: string) {
    const clean = v.replace(/[^0-9]/g, '').slice(0, 2)
    setDraft((d) => ({ ...d, [id]: { home: d[id]?.home ?? '', away: d[id]?.away ?? '', [side]: clean } }))
  }

  async function persist(jobs: { m: Match; home: number; away: number }[]) {
    for (const { m, home, away } of jobs) await saveTip(m.id, home, away)
    await load()
  }

  async function saveCurrent() {
    setBusy(true); setErr(''); setToast('')
    try {
      await persist(dayJobs)
      setToast(t('tippen.savedToast'))
      setTimeout(() => setToast(''), 2500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveAndSwitch() {
    setBusy(true); setErr('')
    try {
      await persist(dayJobs)
      if (pendingMd !== null) setMd(pendingMd)
      setPendingMd(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <header>
        <span className="eyebrow">{t('nav.tippen')}</span>
        <h1>{t('tippen.title')}</h1>
      </header>

      {/* Matchday picker — horizontal scrollbar auf dem Handy */}
      <div className="chips">
        {matchdays.map((d) => (
          <button key={d} className={`btn sm ${d === activeMd ? '' : 'ghost'}`} onClick={() => requestMd(d)}>
            {mdLabel(d)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : dayMatches.length === 0 ? (
        <div className="card pad muted">{t('tippen.noMatches')}</div>
      ) : (
        <div className="panel">
          {dayMatches.map((m, i) => (
            <MatchRow
              key={m.id}
              m={m}
              home={teamsMap.get(m.home_team_id ?? '')}
              away={teamsMap.get(m.away_team_id ?? '')}
              tip={tipsMap.get(m.id)}
              draft={draft[m.id]}
              onChange={setScore}
              lng={lng}
              first={i === 0}
            />
          ))}
        </div>
      )}

      {err && <div className="alert err">{err}</div>}
      <div className="save-bar">
        {toast && <span className="alert ok">{toast}</span>}
        <button className="btn accent" disabled={busy || loading} onClick={saveCurrent}>
          {busy ? t('common.loading') : t('tippen.saveAll')}
        </button>
      </div>

      <ConfirmDialog
        open={pendingMd !== null}
        title={t('unsaved.title')}
        body={t('unsaved.body')}
        saveLabel={t('common.save')}
        discardLabel={t('common.discard')}
        stayLabel={t('unsaved.stay')}
        onSave={saveAndSwitch}
        onDiscard={() => { revertDay(); if (pendingMd !== null) setMd(pendingMd); setPendingMd(null) }}
        onStay={() => setPendingMd(null)}
        busy={busy}
        error={err}
      />
    </div>
  )
}

function MatchRow({
  m, home, away, tip, draft, onChange, lng, first,
}: {
  m: Match; home?: Team; away?: Team; tip?: Tip; draft?: { home: string; away: string }
  onChange: (id: number, side: 'home' | 'away', v: string) => void; lng: string; first: boolean
}) {
  const { t } = useTranslation()
  const locked = kickoffLocked(m.kickoff)
  const finished = m.status === 'FINISHED' && m.full_home != null
  const penalty = m.duration === 'PENALTY_SHOOTOUT'
  const extra = m.duration === 'EXTRA_TIME'
  const probs = impliedProbs(m.odd_home, m.odd_draw, m.odd_away)

  return (
    <div className={`match${first ? ' first' : ''}`}>
      <div className="match-meta">
        <div className="d">{fmtDate(m.kickoff, lng)}</div>
        <div className="tm">{fmtTime(m.kickoff, lng)}</div>
        <div className="rd">{matchLabel(m, lng, t('common.group'))}</div>
      </div>

      {/* Desktop: zentriert Heim 🏴 [ ]:[ ] 🏴 Gast */}
      <div className="match-teams-d">
        <span className="row" style={{ gap: 8, flex: 1, justifyContent: 'flex-end' }}>
          <strong style={{ fontWeight: 600, textAlign: 'right' }}>{home ? teamName(home, lng) : t('tippen.tbd')}</strong>
          <Flag team={home} />
        </span>
        <span className="row" style={{ gap: 6 }}>
          <input className="score-input" inputMode="numeric" disabled={locked} value={draft?.home ?? ''} onChange={(e) => onChange(m.id, 'home', e.target.value)} placeholder="–" aria-label={home ? teamName(home, lng) : 'Heim'} />
          <span className="muted" style={{ fontWeight: 700 }}>:</span>
          <input className="score-input" inputMode="numeric" disabled={locked} value={draft?.away ?? ''} onChange={(e) => onChange(m.id, 'away', e.target.value)} placeholder="–" aria-label={away ? teamName(away, lng) : 'Gast'} />
        </span>
        <span className="row" style={{ gap: 8, flex: 1 }}>
          <Flag team={away} />
          <strong style={{ fontWeight: 600 }}>{away ? teamName(away, lng) : t('tippen.tbd')}</strong>
        </span>
      </div>

      {/* Mobil: je Team eine Zeile (Flagge · Name · Eingabe) */}
      <div className="match-teams-m">
        <div className="team-row">
          <Flag team={home} />
          <span className="nm">{home ? teamName(home, lng) : t('tippen.tbd')}</span>
          <input className="score-input" inputMode="numeric" disabled={locked} value={draft?.home ?? ''} onChange={(e) => onChange(m.id, 'home', e.target.value)} placeholder="–" aria-label={home ? teamName(home, lng) : 'Heim'} />
        </div>
        <div className="team-row">
          <Flag team={away} />
          <span className="nm">{away ? teamName(away, lng) : t('tippen.tbd')}</span>
          <input className="score-input" inputMode="numeric" disabled={locked} value={draft?.away ?? ''} onChange={(e) => onChange(m.id, 'away', e.target.value)} placeholder="–" aria-label={away ? teamName(away, lng) : 'Gast'} />
        </div>
      </div>

      {/* Status / Ergebnis / Punkte */}
      <div className="match-status">
        {finished ? (
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {m.full_home}:{m.full_away}{penalty ? ` ${t('tippen.afterPens')}` : extra ? ` ${t('tippen.afterEt')}` : ''}
            </span>
            {penalty && m.eff_home != null && (
              <span className="muted" style={{ fontSize: '.72rem', display: 'block' }}>{t('tippen.counted', { h: m.eff_home, a: m.eff_away })}</span>
            )}
            {tip?.points != null && <span className={ptsClass(tip.points)} style={{ fontSize: '1.1rem', display: 'block' }}>+{tip.points}</span>}
          </div>
        ) : locked ? (
          <span className="badge purpur">{t('common.locked')}</span>
        ) : (
          <span className="badge petrol">{t('tippen.lockedAt', { time: fmtTime(m.kickoff, lng) })}</span>
        )}
      </div>

      {probs && (
        <div className="match-odds">
          <div className="odds-bar" title={`Quoten  1 ${m.odd_home}  ·  X ${m.odd_draw}  ·  2 ${m.odd_away}`}>
            <span className="oh" style={{ flexGrow: probs.home }}>1 · {probs.home}%</span>
            <span className="od" style={{ flexGrow: probs.draw }}>X · {probs.draw}%</span>
            <span className="oa" style={{ flexGrow: probs.away }}>2 · {probs.away}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
