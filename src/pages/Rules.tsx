import { useTranslation } from 'react-i18next'

function RuleRow({ pts, label, cls }: { pts: string; label: string; cls: string }) {
  return (
    <div className="row" style={{ gap: 14, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <span className={`tag-rule ${cls}`} style={{ background: 'var(--graylight)' }}>{pts}</span>
      <span style={{ fontWeight: 600 }}>{label}</span>
    </div>
  )
}

export default function Rules() {
  const { t } = useTranslation()

  const examples: Array<[string, string, number]> = [
    ['2:1', '2:1', 4],
    ['1:0', '3:2', 3],
    ['2:1', '3:0', 2],
    ['1:1', '1:1', 4],
    ['1:1', '2:2', 2],
    ['2:1', '0:1', 0],
  ]

  return (
    <div className="stack" style={{ gap: 22, maxWidth: 860 }}>
      <header>
        <span className="eyebrow">{t('nav.rules')}</span>
        <h1>{t('rules.title')}</h1>
        <p className="muted">{t('rules.intro')}</p>
      </header>

      {/* Scoring */}
      <section className="panel">
        <div className="panel-head"><h3>{t('rules.scoringTitle')}</h3></div>
        <div className="card pad" style={{ border: 0, boxShadow: 'none' }}>
          <RuleRow pts="4" cls="pts p4" label={t('rules.r4')} />
          <RuleRow pts="3" cls="pts p3" label={t('rules.r3')} />
          <RuleRow pts="2" cls="pts p2" label={t('rules.r2win')} />
          <RuleRow pts="2" cls="pts p2" label={t('rules.r2draw')} />
          <RuleRow pts="0" cls="pts p0" label={t('rules.r0')} />
          <div className="alert info" style={{ marginTop: 14 }}>{t('rules.drawNote')}</div>
        </div>
      </section>

      {/* Examples */}
      <section className="panel">
        <div className="panel-head"><h3>{t('rules.examplesTitle')}</h3></div>
        <table className="table">
          <thead>
            <tr>
              <th>{t('rules.exHead.tip')}</th>
              <th>{t('rules.exHead.result')}</th>
              <th className="num">{t('rules.exHead.pts')}</th>
            </tr>
          </thead>
          <tbody>
            {examples.map(([tip, res, pts], i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{tip}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{res}</td>
                <td className="num"><span className={`pts p${pts}`} style={{ fontSize: '1.1rem' }}>{pts}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="row wrap" style={{ gap: 22, alignItems: 'stretch' }}>
        <section className="card pad" style={{ flex: '1 1 320px' }}>
          <span className="eyebrow">{t('rules.koTitle')}</span>
          <h3 style={{ margin: '6px 0 8px' }}>{t('rules.koTitle')}</h3>
          <p className="muted">{t('rules.koText')}</p>
        </section>
        <section className="card pad" style={{ flex: '1 1 320px' }}>
          <span className="eyebrow">{t('rules.tieTitle')}</span>
          <h3 style={{ margin: '6px 0 8px' }}>{t('rules.tieTitle')}</h3>
          <p className="muted">{t('rules.tieText')}</p>
        </section>
      </div>

      {/* Bonus */}
      <section className="panel">
        <div className="panel-head"><span className="badge purpur">+4</span><h3>{t('rules.bonusTitle')}</h3></div>
        <div className="card pad" style={{ border: 0, boxShadow: 'none' }}>
          <p className="muted">{t('rules.bonusText')}</p>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 2 }}>
            <li>{t('rules.bonusGroups')}</li>
            <li>{t('rules.bonusChampion')}</li>
            <li>{t('rules.bonusSemis')}</li>
            <li>{t('rules.bonusScorer')}</li>
          </ul>
        </div>
      </section>

      {/* Structure + deadlines */}
      <div className="row wrap" style={{ gap: 22, alignItems: 'stretch' }}>
        <section className="card pad" style={{ flex: '1 1 320px' }}>
          <span className="eyebrow">{t('rules.structureTitle')}</span>
          <h3 style={{ margin: '6px 0 8px' }}>{t('rules.structureTitle')}</h3>
          <p className="muted">{t('rules.structureText')}</p>
        </section>
        <section className="card pad" style={{ flex: '1 1 320px' }}>
          <span className="eyebrow">{t('rules.deadlineTitle')}</span>
          <h3 style={{ margin: '6px 0 8px' }}>{t('rules.deadlineTitle')}</h3>
          <p className="muted">{t('rules.deadlineText')}</p>
        </section>
      </div>
    </div>
  )
}
