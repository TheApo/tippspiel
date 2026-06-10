import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  /** true, sobald der Nutzer über einen Passwort-Reset-Link zurückkommt. */
  recovery: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirm: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  /** Reset-Mail an eine beliebige Adresse senden (Self-Service + Admin). */
  resetPassword: (email: string) => Promise<void>
  /** Neues Passwort für den aktuell eingeloggten/recovery-Nutzer setzen. */
  updatePassword: (password: string) => Promise<void>
}

/** Zielseite für E-Mail-Rücksprünge (Bestätigung, Passwort-Reset) — ohne Hash. */
function redirectUrl() {
  return `${window.location.origin}${window.location.pathname}`
}

const Ctx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile((data as Profile) ?? null)
  }

  useEffect(() => {
    // Recovery-Link mit token_hash (aus angepasstem E-Mail-Template): wird
    // geräteübergreifend eingelöst (kein PKCE-Verifier nötig) — wichtig für
    // vom Admin ausgelöste Resets, die der Teilnehmer auf einem anderen Gerät öffnet.
    const params = new URLSearchParams(window.location.search)
    const recoveryToken = params.get('type') === 'recovery' ? params.get('token_hash') : null
    if (recoveryToken) {
      supabase.auth.verifyOtp({ type: 'recovery', token_hash: recoveryToken }).then(({ error }) => {
        if (!error) setRecovery(true)
        // token_hash aus der URL entfernen, Route (#) erhalten
        params.delete('token_hash'); params.delete('type')
        const qs = params.toString()
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
        setLoading(false) // Spinner bis hierhin halten → kein kurzes Aufblitzen der Login-Seite
      })
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (recoveryToken) return // Loading-Status steuert der verifyOtp-Zweig
      if (data.session) loadProfile(data.session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (s) loadProfile(s.user.id)
      else setProfile(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthState = {
    session,
    profile,
    loading,
    recovery,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email, password, displayName) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: redirectUrl(),
        },
      })
      if (error) throw error
      return { needsConfirm: !data.session }
    },
    async signOut() {
      setRecovery(false)
      await supabase.auth.signOut()
    },
    async refreshProfile() {
      if (session) await loadProfile(session.user.id)
    },
    async resetPassword(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() })
      if (error) throw error
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setRecovery(false)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
