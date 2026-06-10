// Hält fest, ob auf der Tippen-Seite ungespeicherte Tipps liegen, und stellt
// eine Speichern-Funktion bereit. Bewusst ref-basiert: der UnsavedGuard fragt
// den Stand erst beim Navigieren ab (useBlocker ruft die Funktion auf), daher
// braucht es keinen gespiegelten React-State und keine Effekt-Renderkaskaden.
import { createContext, useContext, useRef, type ReactNode } from 'react'

interface UnsavedState {
  /** true, solange ungespeicherte Tipps vorliegen (zur Navigationszeit ausgewertet). */
  isDirty: () => boolean
  setDirty: (b: boolean) => void
  /** Tippen hinterlegt hier seine jeweils aktuelle "speichern"-Funktion. */
  registerSave: (fn: () => Promise<void>) => void
  save: () => Promise<void>
}

const Ctx = createContext<UnsavedState | undefined>(undefined)

export function UnsavedProvider({ children }: { children: ReactNode }) {
  const dirtyRef = useRef(false)
  const saveRef = useRef<() => Promise<void>>(async () => {})

  const value: UnsavedState = {
    isDirty: () => dirtyRef.current,
    setDirty: (b) => { dirtyRef.current = b },
    registerSave: (fn) => { saveRef.current = fn },
    save: () => saveRef.current(),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUnsaved() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useUnsaved must be used within UnsavedProvider')
  return c
}
