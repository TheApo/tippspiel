import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { updateDisplayName } from '../lib/queries'
import { MAX_NAME } from '../lib/format'

const MIN_PW = 6

export default function Profile() {
  const { t, i18n } = useTranslation()
  const { session, profile, refreshProfile, updatePassword } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Passwort ändern (eigener Account)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')

  // Name aktuell halten, sobald das Profil (neu) geladen ist — Anpassung beim
  // Rendern (mit Ref-Guard) statt im Effekt, um Render-Kaskaden zu vermeiden.
  const syncedName = useRef(profile?.display_name ?? '')
  if ((profile?.display_name ?? '') !== syncedName.current) {
    syncedName.current = profile?.display_name ?? ''
    setName(profile?.display_name ?? '')
  }

  const trimmed = name.trim()
  const tooLong = trimmed.length > MAX_NAME
  const dirty = trimmed !== (profile?.display_name ?? '')
  const valid = trimmed.length >= 1 && !tooLong

  const pwTooShort = pw.length > 0 && pw.length < MIN_PW
  const pwMismatch = pw2.length > 0 && pw !== pw2
  const pwValid = pw.length >= MIN_PW && pw === pw2

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

  async function savePassword() {
    if (!pwValid) return
    setPwBusy(true); setPwErr(''); setPwMsg('')
    try {
      await updatePassword(pw)
      setPw(''); setPw2('')
      setPwMsg(t('profile.passwordChanged'))
    } catch (e) {
      setPwErr(e instanceof Error ? e.message : String(e))
    } finally { setPwBusy(false) }
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

      <section className="card pad stack" style={{ gap: 16 }}>
        <div>
          <h3>{t('profile.passwordTitle')}</h3>
          <p className="muted" style={{ marginTop: 4 }}>{t('profile.passwordHint')}</p>
        </div>

        <label className="field">
          {t('auth.newPassword')}
          <input type="password" value={pw} minLength={MIN_PW} autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
          {pwTooShort && <span className="muted" style={{ fontWeight: 400, fontSize: '.8rem', color: 'var(--purpur)' }}>{t('auth.pwTooShort', { n: MIN_PW })}</span>}
        </label>
        <label className="field">
          {t('auth.confirmPassword')}
          <input type="password" value={pw2} autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') savePassword() }} />
          {pwMismatch && <span className="muted" style={{ fontWeight: 400, fontSize: '.8rem', color: 'var(--purpur)' }}>{t('auth.pwMismatch')}</span>}
        </label>

        {pwErr && <div className="alert err">{pwErr}</div>}
        {pwMsg && <div className="alert ok">{pwMsg}</div>}

        <button className="btn accent" disabled={pwBusy || !pwValid} onClick={savePassword}>
          {pwBusy ? t('common.loading') : t('profile.changePassword')}
        </button>
      </section>
    </div>
  )
}
