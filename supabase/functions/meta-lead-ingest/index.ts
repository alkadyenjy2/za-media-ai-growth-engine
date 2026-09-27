const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-za-meta-internal-secret, x-za-agentmail-sync-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

/**
 * LEGACY / NON-CANONICAL.
 *
 * Convex is the only canonical ZA Media backend. This Supabase Edge Function
 * is retained as historical source material and must never perform production
 * Meta or AgentMail operations, even if an old Supabase deployment exists.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return json({
    ok: false,
    reason: 'LEGACY_BACKEND_DISABLED',
    evidence: 'ZA Media integrations are disabled in the legacy Supabase backend. Use the canonical Convex backend only.',
  }, 410)
})
