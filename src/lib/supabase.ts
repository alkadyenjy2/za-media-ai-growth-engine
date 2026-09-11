import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Vercel can build the Vite app even when these public runtime values are not configured.
// Keep the frontend renderable in that case instead of crashing during module evaluation.
const configured = Boolean(supabaseUrl?.trim() && supabaseAnonKey?.trim())

export const supabaseConfigured = configured

export const supabase = createClient(
  configured ? supabaseUrl! : 'https://example.supabase.co',
  configured ? supabaseAnonKey! : 'demo-anon-key',
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  },
)
