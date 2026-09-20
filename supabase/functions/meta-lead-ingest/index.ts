import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BLOCKED_PAGE_IDS = new Set(['179969831856298'])
const BLOCKED_FORM_IDS = new Set(['1117890449167883'])
const BLOCKED_APP_IDS = new Set(['191062257579887'])
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const META_INTERNAL_SECRET = Deno.env.get('META_INTERNAL_SECRET')
const META_PAGE_ACCESS_TOKEN = Deno.env.get('META_PAGE_ACCESS_TOKEN')
const META_APP_ID = Deno.env.get('META_APP_ID')

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}

async function audit(supabase: ReturnType<typeof createClient>, action: string, details: Record<string, unknown>, workspaceId?: string) {
  const { error } = await supabase.from('audit_logs').insert({ action, entity_type: 'meta_lead', actor: 'meta-lead-ingest', details, workspace_id: workspaceId ?? null })
  if (error) throw error
}

function fieldMap(fieldData: unknown) {
  const map = new Map<string, string>()
  for (const row of Array.isArray(fieldData) ? fieldData : []) {
    if (!row || typeof row !== 'object') continue
    const name = String((row as any).name ?? '').trim().toLowerCase()
    const value = String((row as any).value ?? '').trim()
    if (name && value) map.set(name, value)
  }
  return map
}

function first(map: Map<string, string>, names: string[]) {
  for (const name of names) {
    const value = map.get(name)
    if (value) return value
  }
  return null
}

function sha256Hex(value: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then((buffer) => Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join(''))
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'server_configuration_missing' }, 500)
  if (!META_INTERNAL_SECRET) return json({ error: 'internal_secret_not_configured' }, 500)
  if ((req.headers.get('x-za-meta-internal-secret') || '') !== META_INTERNAL_SECRET) return json({ error: 'forbidden' }, 403)
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!META_PAGE_ACCESS_TOKEN) return json({ error: 'token_not_configured', status: 'BLOCKED_BY_HUMAN_ACTION' }, 403)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  try {
    const body = await req.json()
    const leadgenId = String(body.leadgen_id || '').trim()
    const pageId = String(body.page_id || '').trim()
    const formId = String(body.form_id || '').trim()
    if (!leadgenId || !pageId) return json({ error: 'leadgen_id_and_page_id_required' }, 400)
    if (BLOCKED_PAGE_IDS.has(pageId)) return json({ error: 'blocked_page_id' }, 403)
    if (BLOCKED_FORM_IDS.has(formId)) return json({ error: 'blocked_form_id' }, 403)

    const { data: connection, error: connectionError } = await supabase.from('meta_connections')
      .select('id,workspace_id,page_id,app_id,display_name,status,metadata')
      .eq('page_id', pageId).eq('status', 'verified').limit(1).maybeSingle()
    if (connectionError) throw connectionError
    if (!connection?.workspace_id || !String(connection.display_name || '').toLowerCase().includes('za media')) {
      await audit(supabase, 'meta_lead_rejected', { reason: 'no_verified_za_media_connection', leadgen_id: leadgenId, page_id: pageId, form_id: formId })
      return json({ error: 'no_verified_za_media_connection', status: 'BLOCKED_BY_HUMAN_ACTION' }, 403)
    }
    if (BLOCKED_APP_IDS.has(String(connection.app_id || ''))) return json({ error: 'blocked_app_id' }, 403)
    if (META_APP_ID && String(connection.app_id || '') !== META_APP_ID) return json({ error: 'app_mismatch' }, 403)

    const graphUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(leadgenId)}?fields=id,created_time,field_data,ad_id,adset_id,campaign_id,form_id,partner_id,platform`
    const graphRes = await fetch(`${graphUrl}&access_token=${encodeURIComponent(META_PAGE_ACCESS_TOKEN)}`)
    const graphData = await graphRes.json()
    if (!graphRes.ok || graphData?.error) {
      await audit(supabase, 'meta_lead_fetch_failed', { leadgen_id: leadgenId, page_id: pageId, form_id: formId, reason: graphData?.error ?? 'graph_api_error' }, connection.workspace_id)
      return json({ error: 'graph_api_fetch_failed' }, 502)
    }
    if (String(graphData.id || '') !== leadgenId) return json({ error: 'lead_identity_mismatch' }, 502)
    if (graphData.form_id && formId && String(graphData.form_id) !== formId) return json({ error: 'form_identity_mismatch' }, 403)

    const fieldData = Array.isArray(graphData.field_data) ? graphData.field_data : []
    const fields = fieldMap(fieldData)
    const canonicalName = first(fields, ['company_name', 'business_name', 'company', 'business', 'full_name', 'name']) || `Meta Lead ${leadgenId}`
    const country = first(fields, ['country'])
    const city = first(fields, ['city'])
    const contentHash = await sha256Hex(JSON.stringify(fieldData))
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: result, error: ingestError } = await supabase.rpc('ingest_meta_lead_atomic', {
      p_workspace_id: connection.workspace_id, p_leadgen_id: leadgenId, p_page_id: pageId, p_form_id: formId,
      p_canonical_name: canonicalName, p_country: country, p_city: city,
      p_profile_data: { source: 'Meta Lead Ads', contact: { full_name: first(fields, ['full_name', 'name']), email: first(fields, ['email', 'email_address']), phone: first(fields, ['phone_number', 'phone']), job_title: first(fields, ['job_title']) } },
      p_evidence_data: { leadgen_id: leadgenId, page_id: pageId, form_id: formId, created_time: graphData.created_time ?? body.created_time ?? null, ad_id: graphData.ad_id ?? null, adset_id: graphData.adset_id ?? null, campaign_id: graphData.campaign_id ?? null, platform: graphData.platform ?? null, field_data: fieldData },
      p_content_hash: contentHash, p_expires_at: expiresAt,
    })
    if (ingestError) {
      await audit(supabase, 'meta_lead_persist_failed', { leadgen_id: leadgenId, page_id: pageId, form_id: formId, reason: ingestError.message }, connection.workspace_id)
      return json({ error: 'persist_failed' }, 500)
    }
    const row = Array.isArray(result) ? result[0] : result
    if (!row?.prospect_id || !row?.evidence_id) return json({ error: 'evidence_gate_failed' }, 500)
    return json({ success: true, duplicate: Boolean(row.duplicate), prospect_id: row.prospect_id, evidence_id: row.evidence_id, external_id: leadgenId, content_hash: contentHash })
  } catch (error) {
    try { await audit(supabase, 'meta_lead_ingest_error', { reason: error instanceof Error ? error.message : String(error) }) } catch { /* preserve internal error */ }
    return json({ error: 'internal_error' }, 500)
  }
})