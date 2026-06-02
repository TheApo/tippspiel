import { useTranslation } from 'react-i18next'
import logo from '../assets/bms-cs-logo.png'

export default function ConfigGate() {
  const { t } = useTranslation()
  return (
    <div className="app">
      <div className="page container" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="card pad fade-in" style={{ maxWidth: 520 }}>
          <img src={logo} alt="BMS CS" style={{ height: 32, marginBottom: 18 }} />
          <span className="eyebrow">Setup</span>
          <h2 style={{ margin: '6px 0 10px' }}>{t('config.title')}</h2>
          <p className="muted">{t('config.body')}</p>
          <pre
            style={{
              background: 'var(--graylight)', padding: 14, borderRadius: 10,
              fontFamily: 'var(--font-mono)', fontSize: 13, overflowX: 'auto',
            }}
          >{`VITE_SUPABASE_URL=https://…supabase.co
VITE_SUPABASE_ANON_KEY=eyJ…`}</pre>
        </div>
      </div>
    </div>
  )
}
