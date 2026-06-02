import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  fetchBonusQuestions, fetchTeams, fetchMyBonusTips, fetchSettings, saveBonusTip,
} from '../lib/queries'
import type { BonusQuestion, Team, BonusTip, AppSettings } from '../lib/types'
import { kickoffLocked, ptsClass } from '../lib/format'
import { teamName } from '../lib/teamNames'
import { Flag } from '../components/Flag'

type Draft = Record<string, string[]>

export default function Bonus() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage
  const { session } = useAuth()
  const [questions, setQuestions] = useState<BonusQuestion[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [myTips, setMyTips] = useState<BonusTip[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    const [q, tm, bt, s] = await Promise.all([
      fetchBonusQuestions(), fetchTeams(),
      session ? fetchMyBonusTips(session.user.id) : Promise.resolve([]),
      fetchSettings(),
    ])
    setQuestions(q); setTeams(tm); setMyTips(bt); setSettings(s)
    const d: Draft = {}
    for (const x of bt) d[x.question_id] = x.picks
    setDraft(d)
  }
  useEffect(() => { load().finally(() => setLoading(false)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const closed = Boolean(settings?.bonus_deadline && kickoffLocked(settings.bonus_deadline))
  const tipsMap = useMemo(() => new Map(myTips.map((x) => [x.question_id, x])), [myTips])
  const teamsByGroup = useMemo(() => {
    const g: Record<string, Team[]> = {}
    for (const t of teams) if (t.group_letter) (g[t.group_letter] ??= []).push(t)
    return g
  }, [teams])
  const groupQ = questions.filter((q) => q.category === 'group_winner')
  const championQ = questions.find((q) => q.category === 'champion')
  const semiQ = questions.find((q) => q.category === 'semifinalists')
  const scorerQ = questions.find((q) => q.category === 'top_scorer')

  function setSingle(qid: string, val: string) {
    setDraft((d) => ({ ...d, [qid]: val ? [val] : [] }))
  }
  function toggleSemi(teamId: string) {
    setDraft((d) => {
      const cur = d[semiQ!.id] ?? []
      if (cur.includes(teamId)) return { ...d, [semiQ!.id]: cur.filter((x) => x !== teamId) }
      if (cur.length >= 4) return d
      return { ...d, [semiQ!.id]: [...cur, teamId] }
    })
  }

  async function saveAll() {
    setBusy(true); setErr(''); setToast('')
    try {
      for (const q of questions) {
        const picks = draft[q.id] ?? []
        const cur = tipsMap.get(q.id)?.picks ?? []
        const changed = picks.length !== cur.length || picks.some((p, i) => p !== cur[i])
        if (picks.length && changed) await saveBonusTip(q.id, picks)
      }
      await load()
      setToast(t('common.saved')); setTimeout(() => setToast(''), 2500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  if (loading) return <div className="skeleton" style={{ height: 320 }} />

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 860 }}>
      <header>
        <span className="eyebrow">{t('nav.bonus')} · +4</span>
        <h1>{t('bonus.title')}</h1>
        <p className="muted">{t('bonus.intro')}</p>
      </header>

      {closed && <div className="alert info">{t('bonus.closed')}</div>}

      {/* Champion + Top scorer */}
      <div className="row wrap" style={{ gap: 22, alignItems: 'stretch' }}>
        <BonusCard title={t('bonus.champion')} q={championQ} tip={tipsMap.get('champion')}>
          <TeamSelect teams={teams} lng={lng} value={draft.champion?.[0] ?? ''} disabled={closed} onChange={(v) => setSingle('champion', v)} placeholder={t('bonus.selectTeam')} />
        </BonusCard>
        <BonusCard title={t('bonus.topScorer')} q={scorerQ} tip={tipsMap.get('top_scorer')}>
          <TeamSelect teams={teams} lng={lng} value={draft.top_scorer?.[0] ?? ''} disabled={closed} onChange={(v) => setSingle('top_scorer', v)} placeholder={t('bonus.selectTeam')} />
        </BonusCard>
      </div>

      {/* Semifinalists */}
      <section className="panel">
        <div className="panel-head">
          <h3>{t('bonus.semifinalists')}</h3><span className="spacer" />
          <span className="badge petrol">{t('bonus.pickFour', { count: (draft[semiQ?.id ?? ''] ?? []).length })}</span>
        </div>
        <div className="card pad" style={{ border: 0, boxShadow: 'none', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {teams.length === 0 && <span className="muted">{t('home.noData')}</span>}
          {teams.map((team) => {
            const picked = (draft[semiQ?.id ?? ''] ?? []).includes(team.id)
            return (
              <button
                key={team.id}
                disabled={closed}
                onClick={() => toggleSemi(team.id)}
                className="row"
                style={{
                  gap: 8, padding: '7px 12px', borderRadius: 999, cursor: closed ? 'default' : 'pointer',
                  border: `1.5px solid ${picked ? 'var(--petrol)' : 'var(--line)'}`,
                  background: picked ? 'var(--petrol-soft)' : 'var(--white)', fontWeight: 600,
                }}
              >
                <Flag team={team} /> {team.tla ?? team.name}
              </button>
            )
          })}
        </div>
      </section>

      {/* Group winners */}
      <section className="panel">
        <div className="panel-head"><h3>{t('nav.bonus')}: {t('common.group')} A–L</h3></div>
        <div className="card pad" style={{ border: 0, boxShadow: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          {groupQ.map((q) => (
            <label key={q.id} className="field">
              {t('bonus.groupWinner', { group: q.group_letter })}
              <TeamSelect
                teams={teamsByGroup[q.group_letter ?? ''] ?? []}
                lng={lng}
                value={draft[q.id]?.[0] ?? ''}
                disabled={closed}
                onChange={(v) => setSingle(q.id, v)}
                placeholder={t('bonus.selectTeam')}
              />
              {q.answer && <BonusResult tip={tipsMap.get(q.id)} />}
            </label>
          ))}
        </div>
      </section>

      {err && <div className="alert err">{err}</div>}
      {!closed && (
        <div className="row" style={{ position: 'sticky', bottom: 16, justifyContent: 'flex-end', gap: 12 }}>
          {toast && <span className="alert ok">{toast}</span>}
          <button className="btn accent" disabled={busy} onClick={saveAll}>{busy ? t('common.loading') : t('bonus.save')}</button>
        </div>
      )}
    </div>
  )
}

function TeamSelect({ teams, value, onChange, disabled, placeholder, lng }: {
  teams: Team[]; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder: string; lng?: string
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {teams.map((team) => <option key={team.id} value={team.id}>{teamName(team, lng)}</option>)}
    </select>
  )
}

function BonusCard({ title, q, tip, children }: {
  title: string; q?: BonusQuestion; tip?: BonusTip; children: React.ReactNode
}) {
  return (
    <section className="card pad" style={{ flex: '1 1 320px', borderTop: '4px solid var(--purpur)' }}>
      <span className="eyebrow">{title}</span>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
      {q?.answer && <BonusResult tip={tip} />}
    </section>
  )
}

function BonusResult({ tip }: { tip?: BonusTip }) {
  if (tip?.points == null) return null
  return <span className={ptsClass(tip.points)} style={{ fontWeight: 700, marginTop: 4 }}>+{tip.points}</span>
}
