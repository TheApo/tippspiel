// Blockiert Router-Navigation (Spieltag ist Component-State und wird in Tippen
// separat behandelt), solange ungespeicherte Tipps vorliegen, und bietet
// Speichern / Verwerfen / Bleiben an. Lebt im Layout = Wurzel des Data-Routers,
// damit useBlocker verfügbar ist.
import { useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUnsaved } from '../context/UnsavedContext'
import ConfirmDialog from './ConfirmDialog'

export default function UnsavedGuard() {
  const { t } = useTranslation()
  const { isDirty, save } = useUnsaved()
  // Funktion statt Boolean: useBlocker wertet sie erst beim Navigieren aus.
  const blocker = useBlocker(isDirty)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const blocked = blocker.state === 'blocked'

  async function onSave() {
    setBusy(true); setErr('')
    try {
      await save()
      blocker.proceed?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open={blocked}
      title={t('unsaved.title')}
      body={t('unsaved.body')}
      saveLabel={t('common.save')}
      discardLabel={t('common.discard')}
      stayLabel={t('unsaved.stay')}
      onSave={onSave}
      onDiscard={() => blocker.proceed?.()}
      onStay={() => { setErr(''); blocker.reset?.() }}
      busy={busy}
      error={err}
    />
  )
}
