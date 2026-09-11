import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const input = await req.json().catch(() => ({}))
    const batchSize = Math.max(1, Math.min(Number(input.batch_size ?? 10), 25))

    const { data: due, error: dueError } = await supabase
      .from('prospect_profiles')
      .select('id,canonical_name,next_review_at')
      .not('lifecycle_status', 'in', '(archived,disqualified)')
      .or(`next_review_at.is.null,next_review_at.lte.${new Date().toISOString()}`)
      .order('next_review_at', { ascending: true, nullsFirst: true })
      .limit(batchSize)
    if (dueError) throw dueError

    const results: any[] = []
    for (const prospect of due ?? []) {
      const headers = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json' }
      const intentResponse = await fetch(`${supabaseUrl}/functions/v1/intent-engine`, {
        method: 'POST', headers, body: JSON.stringify({ prospect_id: prospect.id }),
      })
      const intent = await intentResponse.json().catch(() => ({ ok: false, error: 'Invalid intent response' }))
      if (!intentResponse.ok || !intent?.ok) {
        results.push({ prospect_id: prospect.id, canonical_name: prospect.canonical_name, ok: false, stage: 'intent', error: intent?.error ?? `HTTP ${intentResponse.status}` })
        continue
      }

      const scoreResponse = await fetch(`${supabaseUrl}/functions/v1/scoring-engine`, {
        method: 'POST', headers, body: JSON.stringify({ prospect_id: prospect.id }),
      })
      const scoring = await scoreResponse.json().catch(() => ({ ok: false, error: 'Invalid scoring response' }))
      results.push({
        prospect_id: prospect.id,
        canonical_name: prospect.canonical_name,
        ok: scoreResponse.ok && Boolean(scoring?.ok),
        intent_inserted: intent.inserted ?? 0,
        intent_skipped_duplicates: intent.skipped_duplicates ?? 0,
        scores: scoring?.scores ?? null,
        error: scoreResponse.ok && scoring?.ok ? null : scoring?.error ?? `HTTP ${scoreResponse.status}`,
      })
    }

    await supabase.from('audit_logs').insert({
      action: 'prospect_monitoring_cycle',
      entity_type: 'prospect_monitoring',
      actor: 'AI Core',
      details: {
        batch_size: batchSize,
        due: due?.length ?? 0,
        processed: results.length,
        successful: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        pipeline: 'monitor->intent->score',
      },
    })

    return json({ ok: true, pipeline: 'monitor->intent->score', due: due?.length ?? 0, processed: results.length, results })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
