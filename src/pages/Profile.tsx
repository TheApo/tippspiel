import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { updateDisplayName } from '../lib/queries'
import { MAX_NAME } from '../lib/format'

export default function Profile() {
  const { t, i18n } = useTranslation()
  const { session, profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Name aktuell halten, sobald das Profil (neu) geladen ist
  useEffect(() => { setName(profile?.display_name ?? '') }, [profile?.display_name])

  const trimmed = name.trim()
  const tooLong = trimmed.length > MAX_NAME
  const dirty = trimmed !== (profile?.display_name ?? '')
  const valid = trimmed.length >= 1 && !tooLong

  async function save() {
    if (!session || !valid) return
    setBusy(true); setErr(''); setMsg('')
    try {
      await updateDisplayName(session.user.id, trimmed)
      await refreshProfile()
      setMsg(t('common.saved'))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 520 }}>
      <header>
        <span className="eyebrow">{t('account.profile')}</span>
        <h1>{t('profile.title')}</h1>
        <p className="muted">{t('profile.subtitle')}</p>
      </header>

      <section className="card pad stack" style={{ gap: 16 }}>
        <label className="field">
          {t('auth.displayName')}
          <input
            type="text"
            value={name}
            maxLength={MAX_NAME}
            placeholder="Max M."
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
          <span className="muted" style={{ fontWeight: 400, fontSize: '.8rem', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{t('auth.displayNameHint')}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: tooLong ? 'var(--purpur)' : undefined }}>{trimmed.length}/{MAX_NAME}</span>
          </span>
        </label>

        <label className="field">
          {t('profile.emailLabel')}
          <input type="email" value={profile?.email ?? ''} disabled />
          <span className="muted" style={{ fontWeight: 400, fontSize: '.8rem' }}>{t('profile.emailFixed')}</span>
        </label>

        <div className="stack" style={{ gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--navy)' }}>{t('account.language')}</span>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {(['de', 'en'] as const).map((l) => (
              <button key={l} type="button" className={i18n.resolvedLanguage === l ? 'on' : ''} onClick={() => i18n.changeLanguage(l)}>
                {l === 'de' ? 'Deutsch' : 'English'}
              </button>
            ))}
          </div>
        </div>

        {err && <div className="alert err">{err}</div>}
        {msg && <div className="alert ok">{msg}</div>}

        <button className="btn accent" disabled={busy || !dirty || !valid} onClick={save}>
          {busy ? t('common.loading') : t('common.save')}
        </button>
      </section>
    </div>
  )
}
