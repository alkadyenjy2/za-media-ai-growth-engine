import { createClient } from '@supabase/supabase-js'

// The Supabase publishable key is safe to ship in a browser client. Keep the
// environment variables as the preferred configuration, with a project-scoped
// public fallback so the deployed frontend cannot silently fall back to local demo mode.
const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  'https://kipkdfydajlqsoaslhuv.supabase.co'
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  'sb_publishable_FR9VCzzq_2PoUtWPEjSxZQ_8HCYWXXv'

const configured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabaseConfigured = configured

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
