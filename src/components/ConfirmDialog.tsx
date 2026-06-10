// Wiederverwendbarer modaler Bestätigungsdialog (on-brand, KISS).
// Bis zu drei Aktionen: Speichern (optional) / Verwerfen (optional) / Bleiben.
import { useEffect, type ReactNode } from 'react'

export default function ConfirmDialog({
  open, title, body, saveLabel, discardLabel, stayLabel,
  onSave, onDiscard, onStay, busy = false, error,
}: {
  open: boolean
  title: string
  body?: ReactNode
  saveLabel?: string
  discardLabel?: string
  stayLabel: string
  onSave?: () => void
  onDiscard?: () => void
  onStay: () => void
  busy?: boolean
  error?: string
}) {
  // Escape = Bleiben (sichere Default-Aktion)
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onStay() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onStay])

  if (!open) return null

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onStay() }}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {body && <p className="muted" style={{ marginTop: 8 }}>{body}</p>}
        {error && <div className="alert err" style={{ marginTop: 12 }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={onStay} disabled={busy}>{stayLabel}</button>
          {onDiscard && <button className="btn ghost sm" style={{ color: 'var(--purpur)', borderColor: 'var(--purpur)' }} onClick={onDiscard} disabled={busy}>{discardLabel}</button>}
          {onSave && <button className="btn accent sm" onClick={onSave} disabled={busy}>{busy ? '…' : saveLabel}</button>}
        </div>
      </div>
    </div>
  )
}
