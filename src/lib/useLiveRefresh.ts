// Pollt eine Reload-Funktion in festem Intervall, solange `active` true ist
// (= mindestens ein Spiel läuft). Kein State im Hook -> keine Render-Kaskaden.
import { useEffect, useRef } from 'react'

export function useLiveRefresh(active: boolean, reload: () => void, ms = 20000) {
  const ref = useRef(reload)
  useEffect(() => { ref.current = reload }, [reload])
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => ref.current(), ms)
    return () => clearInterval(id)
  }, [active, ms])
}
