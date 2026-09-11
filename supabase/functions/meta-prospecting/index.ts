import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

function responseJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders })
}

function normalizePlatform(value: unknown) {
  const platform = String(value ?? '').toLowerCase()
  if (!['facebook', 'instagram'].includes(platform)) throw new Error('platform must be facebook or instagram')
  return platform
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return responseJson({ ok: false, error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')

    const input = await req.json()
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    if (input.action === 'status') {
      const { data, error } = await supabase.from('meta_connections').select('id,connection_type,display_name,status,meta_business_id,page_id,instagram_account_id,scopes,token_expires_at,last_sync_at,last_error,updated_at').order('updated_at', { ascending: false })
      if (error) throw error
      return responseJson({ ok: true, connections: data ?? [] })
    }

    if (input.action === 'register_connection') {
      const connectionType = String(input.connection_type ?? '')
      if (!['meta_business', 'facebook_page', 'instagram_business'].includes(connectionType)) throw new Error('Unsupported Meta connection type')
      const displayName = String(input.display_name ?? '').trim()
      if (!displayName) throw new Error('display_name is required')
      const { data, error } = await supabase.from('meta_connections').insert({
        connection_type: connectionType,
        display_name: displayName,
        status: 'pending',
        meta_business_id: input.meta_business_id ?? null,
        page_id: input.page_id ?? null,
        instagram_account_id: input.instagram_account_id ?? null,
        scopes: Array.isArray(input.scopes) ? input.scopes.slice(0, 50) : [],
        token_secret_name: input.token_secret_name ?? null,
        metadata: { authorization_required: true, policy: 'official Meta APIs/OAuth only' },
      }).select('id,connection_type,display_name,status,meta_business_id,page_id,instagram_account_id,scopes,token_secret_name').single()
      if (error) throw error
      await supabase.from('audit_logs').insert({ action: 'meta_connection_registered', entity_type: 'meta_connection', entity_id: data.id, actor: 'AI Core', details: { connection_type: connectionType } })
      return responseJson({ ok: true, connection: data, next: 'OAuth authorization is required before live Meta data can be fetched.' })
    }

    if (input.action === 'record_target') {
      if (!input.connection_id || !input.prospect_id) throw new Error('connection_id and prospect_id are required')
      const platform = normalizePlatform(input.platform)
      const { data, error } = await supabase.from('meta_prospect_targets').upsert({
        connection_id: input.connection_id,
        prospect_id: input.prospect_id,
        platform,
        external_id: input.external_id ?? null,
        profile_url: input.profile_url ?? null,
        discovery_method: input.discovery_method ?? 'manual',
        match_confidence: Math.max(0, Math.min(1, Number(input.match_confidence ?? 0))),
        status: input.status ?? 'candidate',
        evidence: input.evidence ?? {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'connection_id,platform,external_id' }).select().single()
      if (error) throw error
      return responseJson({ ok: true, target: data })
    }

    return responseJson({ ok: false, error: 'Unsupported action', supported_actions: ['status', 'register_connection', 'record_target'] }, 400)
  } catch (error) {
    return responseJson({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
