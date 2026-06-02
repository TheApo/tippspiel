import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'
import logo from '../assets/bms-cs-logo.png'

function AccountMenu() {
  const { t, i18n } = useTranslation()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const lng = i18n.resolvedLanguage

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="account" ref={ref}>
      <button className="account-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{initials(profile?.display_name ?? '?')}</span>
        <span className="account-name">{profile?.display_name}</span>
        <span className="caret">▾</span>
      </button>

      {open && (
        <div className="account-pop card" role="menu">
          <div className="account-head">
            <span className="avatar lg">{initials(profile?.display_name ?? '?')}</span>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block' }}>{profile?.display_name}</strong>
              <span className="muted" style={{ fontSize: '.8rem', wordBreak: 'break-all' }}>{profile?.email}</span>
              {profile?.is_admin && <span className="badge purpur" style={{ marginTop: 4 }}>Admin</span>}
            </div>
          </div>

          <hr className="divider" />

          <div className="account-row">
            <span className="muted" style={{ fontWeight: 600 }}>{t('account.language')}</span>
            <div className="lang-toggle light">
              {(['de', 'en'] as const).map((l) => (
                <button key={l} className={lng === l ? 'on' : ''} onClick={() => i18n.changeLanguage(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {profile?.is_admin && (
            <button className="account-item" role="menuitem" onClick={() => { setOpen(false); navigate('/admin') }}>
              ⚙ {t('account.admin')}
            </button>
          )}
          <button className="account-item danger" role="menuitem" onClick={() => signOut()}>
            ⏻ {t('common.logout')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()

  const links: Array<[string, string]> = [
    ['/', t('nav.home')],
    ['/tippen', t('nav.tippen')],
    ['/bonus', t('nav.bonus')],
    ['/tippuebersicht', t('nav.overview')],
    ['/gesamtliste', t('nav.leaderboard')],
    ['/tabellen', t('nav.tables')],
    ['/regeln', t('nav.rules')],
  ]

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <NavLink to="/" className="brand">
            <img src={logo} alt="BMS Corporate Solutions" />
            <span className="sep" />
            <span className="tag">Tippspiel</span>
          </NavLink>

          <nav className="nav">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                {label}
              </NavLink>
            ))}
          </nav>

          <AccountMenu />
        </div>
      </header>

      <main className="page">
        <div className="container fade-in">{children}</div>
      </main>

      <footer className="footer">
        <div className="container row wrap">
          <span>© BMS Corporate Solutions GmbH</span>
          <span className="spacer" />
          <span>{t('appName')} · {t('tournament')}</span>
        </div>
      </footer>
    </div>
  )
}
