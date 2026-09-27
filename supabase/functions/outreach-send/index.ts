const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

/**
 * LEGACY / NON-CANONICAL.
 *
 * Convex is the only canonical ZA Media backend. This Supabase Edge Function
 * is retained only as historical source material and must never dispatch
 * external outreach, even if an old Supabase deployment still exists.
 *
 * The canonical sender is convex/outreach.ts, which is independently
 * fail-closed by production freeze, authentication, approval, and credential
 * gates.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  // Permanent legacy safety barrier: no external email may be sent from the
  // retained Supabase source tree.
  return json({
    ok: false,
    reason: 'LEGACY_BACKEND_DISABLED',
    evidence: 'ZA Media outbound dispatch is disabled in the legacy Supabase backend. Use the canonical Convex backend only.',
  }, 410)
})
