import { createClient } from '@supabase/supabase-js'

// ZA Media production Supabase project. This is the public publishable key and is
// intentionally safe to ship in the browser. Keep secrets out of this file.
const supabaseUrl = 'https://kipkdfydajlqsoaslhuv.supabase.co'
const supabasePublishableKey = 'sb_publishable_FR9VCzzq_2PoUtWPEjSxZQ_8HCYWXXv'

export const supabaseConfigured = true

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
