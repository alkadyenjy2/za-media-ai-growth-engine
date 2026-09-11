import { createClient } from '@supabase/supabase-js'

// The Supabase publishable key is safe to ship in a browser client. Keep the
// environment variables as the preferred configuration, with a project-scoped
// public fallback so the deployed demo cannot silently fall back to local demo mode.
const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  'https://kipkdfydajlqsoaslhuv.supabase.co'
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  'sb_publishable_FR9VCzzq_2PoUtWPEjSxZQ_8HCYWXXv'

const configured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabaseConfigured = configured

type DemoResult = { data: any; error: null; count?: number | null }

function demoQuery(): any {
  const result: DemoResult = { data: [], error: null, count: 0 }
  const query: any = {
    select: () => query,
    insert: () => query,
    update: () => query,
    upsert: () => query,
    delete: () => query,
    order: () => query,
    limit: () => query,
    range: () => query,
    eq: () => query,
    neq: () => query,
    gt: () => query,
    gte: () => query,
    lt: () => query,
    lte: () => query,
    in: () => query,
    match: () => query,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (value: DemoResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return query
}

const demoSupabase: any = {
  from: () => demoQuery(),
  functions: {
    invoke: async () => ({ data: null, error: { message: 'Supabase is not configured' } }),
  },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signOut: async () => ({ error: null }),
  },
}

// Keep the deployed frontend fully renderable without requiring Vercel env configuration.
// When Supabase is configured, use the real client. Otherwise use a local demo adapter so
// page effects can safely resolve with empty data instead of crashing or making network calls.
export const supabase = configured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : demoSupabase
