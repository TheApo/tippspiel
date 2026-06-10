// Vollbild-Screen nach Klick auf den Passwort-Reset-Link (recovery-Session).
// Neues Passwort + Bestätigung → updateUser → recovery=false → normale App.
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/bms-cs-logo.png'

const MIN_PW = 6

export default function ResetPassword() {
  const { t, i18n } = useTranslation()
  const { updatePassword, signOut } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const tooShort = pw.length > 0 && pw.length < MIN_PW
  const mismatch = pw2.length > 0 && pw !== pw2
  const valid = pw.length >= MIN_PW && pw === pw2

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true); setErr('')
    try {
      await updatePassword(pw)
      // recovery wird false → App rendert die normale Oberfläche
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="app" style={{ background: 'var(--navy)', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form onSubmit={submit} className="card pad stack" style={{ width: '100%', maxWidth: 400, gap: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <img src={logo} alt="BMS Corporate Solutions" style={{ height: 26 }} />
          <div className="lang-toggle" style={{ background: 'var(--lilac)' }}>
            {(['de', 'en'] as const).map((l) => (
              <button type="button" key={l} className={i18n.resolvedLanguage === l ? 'on' : ''} style={{ color: i18n.resolvedLanguage === l ? 'var(--navy)' : 'var(--navy-300)' }} onClick={() => i18n.changeLanguage(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <header>
          <span className="eyebrow">{t('tournament')}</span>
          <h2 style={{ fontSize: '1.5rem', marginTop: 4 }}>{t('auth.recoveryTitle')}</h2>
          <p className="muted" style={{ marginTop: 6 }}>{t('auth.recoverySubtitle')}</p>
        </header>

        <label className="field">
          {t('auth.newPassword')}
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={MIN_PW} autoComplete="new-password" autoFocus />
          {tooShort && <span className="muted" style={{ fontWeight: 400, fontSize: '.8rem', color: 'var(--purpur)' }}>{t('auth.pwTooShort', { n: MIN_PW })}</span>}
        </label>
        <label className="field">
          {t('auth.confirmPassword')}
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password" />
          {mismatch && <span className="muted" style={{ fontWeight: 400, fontSize: '.8rem', color: 'var(--purpur)' }}>{t('auth.pwMismatch')}</span>}
        </label>

        {err && <div className="alert err">{err}</div>}

        <button className="btn accent block" disabled={busy || !valid} type="submit">
          {busy ? t('common.loading') : t('auth.setNewPassword')}
        </button>
        <button type="button" className="btn ghost block sm" onClick={() => signOut()}>
          {t('auth.backToLogin')}
        </button>
      </form>
    </div>
  )
}
