import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { MAX_NAME } from '../lib/format'
import logo from '../assets/bms-cs-logo.png'

export default function Login() {
  const { t, i18n } = useTranslation()
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        const { needsConfirm } = await signUp(email.trim(), password, name.trim())
        if (needsConfirm) setInfo(t('auth.checkEmail'))
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app" style={{ background: 'var(--navy)' }}>
      <div
        style={{
          minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.1fr 1fr',
          color: 'var(--white)',
        }}
        className="login-grid"
      >
        {/* Hero */}
        <section style={{ padding: '56px clamp(24px,5vw,72px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div style={{ position: 'relative' }}>
            <img src={logo} alt="BMS Corporate Solutions" style={{ height: 30, filter: 'brightness(0) invert(1)', marginBottom: 40 }} />
            <span className="eyebrow" style={{ color: 'var(--petrol)' }}>{t('tournament')}</span>
            <h1 style={{ color: 'var(--white)', fontSize: 'clamp(2.2rem,4vw,3.4rem)', margin: '8px 0 16px', maxWidth: 560 }}>
              {t('auth.welcome')}
            </h1>
            <p style={{ color: 'var(--cream)', fontSize: '1.1rem', maxWidth: 460 }}>{t('auth.subtitle')}</p>
            <div className="row" style={{ marginTop: 28, gap: 8, flexWrap: 'wrap' }}>
              {['2', '3', '4'].map((n) => (
                <span key={n} className="badge cream" style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', padding: '8px 14px' }}>{n} {t('common.points')}</span>
              ))}
              <span className="badge petrol" style={{ padding: '8px 14px' }}>Bonus +4</span>
            </div>
          </div>
        </section>

        {/* Form */}
        <section style={{ background: 'var(--graylight)', display: 'grid', placeItems: 'center', padding: 24 }}>
          <form onSubmit={submit} className="card pad" style={{ width: '100%', maxWidth: 380 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: '1.5rem' }}>{mode === 'login' ? t('auth.login') : t('auth.register')}</h2>
              <div className="lang-toggle" style={{ background: 'var(--lilac)' }}>
                {(['de', 'en'] as const).map((l) => (
                  <button type="button" key={l} className={i18n.resolvedLanguage === l ? 'on' : ''} style={{ color: i18n.resolvedLanguage === l ? 'var(--navy)' : 'var(--navy-300)' }} onClick={() => i18n.changeLanguage(l)}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div className="stack">
              {/* Microsoft-Login (SSO) folgt, sobald Entra ID konfiguriert ist */}
              {mode === 'register' && (
                <label className="field">
                  {t('auth.displayName')}
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={MAX_NAME} placeholder="Max M." />
                  <span className="muted" style={{ fontWeight: 400, fontSize: '.8rem', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{t('auth.displayNameHint')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{name.trim().length}/{MAX_NAME}</span>
                  </span>
                </label>
              )}
              <label className="field">
                {t('auth.email')}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="vorname.nachname@bms-cs.de" autoComplete="email" />
              </label>
              <label className="field">
                {t('auth.password')}
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </label>

              {err && <div className="alert err">{err}</div>}
              {info && <div className="alert ok">{info}</div>}

              <button className="btn accent block" disabled={busy} type="submit">
                {busy ? t('common.loading') : mode === 'login' ? t('auth.login') : t('auth.register')}
              </button>

              <button type="button" className="btn ghost block sm" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); setInfo('') }}>
                {mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
              </button>
            </div>
          </form>
        </section>
      </div>
      <style>{`@media (max-width: 820px){ .login-grid{ grid-template-columns: 1fr !important; } .login-grid > section:first-child{ padding: 36px 24px !important; } }`}</style>
    </div>
  )
}
