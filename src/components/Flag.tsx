import { flagUrl } from '../lib/flags'
import type { Team } from '../lib/types'

export function Flag({ team, lg }: { team?: Team | null; lg?: boolean }) {
  const url = flagUrl(team)
  const cls = `flag${lg ? ' lg' : ''}`
  if (!url) return <span className={cls} aria-hidden />
  return <img className={cls} src={url} alt={team?.tla ?? team?.name ?? ''} loading="lazy" />
}

export function TeamLabel({ team, reverse }: { team?: Team | null; reverse?: boolean }) {
  const name = team?.name ?? team?.tla ?? '—'
  return (
    <span className="row" style={{ gap: 8, flexDirection: reverse ? 'row-reverse' : 'row' }}>
      <Flag team={team} />
      <strong style={{ fontWeight: 600 }}>{name}</strong>
    </span>
  )
}
