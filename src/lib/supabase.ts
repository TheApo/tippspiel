import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? ''

/** true, sobald echte Supabase-Zugangsdaten in .env hinterlegt sind. */
export const isConfigured = Boolean(
  url && anon && !url.includes('YOUR-PROJECT') && !anon.includes('YOUR-'),
)

// Fällt nicht hart aus, wenn .env noch Platzhalter enthält — die UI zeigt dann
// einen klaren Hinweis (siehe ConfigGate).
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anon || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // PKCE: Bestätigungs-/OAuth-Rücksprung kommt als ?code=… (Query) statt #token —
      // verträgt sich sauber mit dem HashRouter.
      flowType: 'pkce',
    },
  },
)
