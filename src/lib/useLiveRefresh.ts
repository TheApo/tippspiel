// Pollt eine Reload-Funktion in festem Intervall. `isActive` wird bei JEDEM
// Tick frisch ausgewertet (nicht nur beim Render), damit eine vor Anpfiff
// geöffnete Seite von selbst in den Live-Modus wechselt.
// Kein State im Hook -> keine Render-Kaskaden.
import { useEffect, useRef } from 'react'

export function useLiveRefresh(isActive: () => boolean, reload: () => void, ms = 20000) {
  const ref = useRef({ isActive, reload })
  useEffect(() => { ref.current = { isActive, reload } })
  useEffect(() => {
    const id = setInterval(() => { if (ref.current.isActive()) ref.current.reload() }, ms)
    return () => clearInterval(id)
  }, [ms])
}
