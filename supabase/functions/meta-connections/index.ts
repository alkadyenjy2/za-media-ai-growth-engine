import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireUserWorkspace } from '../_shared/workspace-auth.ts'

const BLOCKED_PAGE_IDS = new Set(['179969831856298'])
const BLOCKED_APP_IDS = new Set(['191062257579887'])
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const META_PAGE_ACCESS_TOKEN = Deno.env.get('META_PAGE_ACCESS_TOKEN')
const META_APP_ID = Deno.env.get('META_APP_ID')

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}

async function audit(supabase: ReturnType<typeof createClient>, action: string, details: Record<string, unknown>, workspaceId: string) {
  const { error } = await supabase.from('audit_logs').insert({ action, entity_type: 'meta_connection', actor: 'meta-connections', details, workspace_id: workspaceId })
  if (error) throw error
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'server_configuration_missing' }, 500)
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const auth = await requireUserWorkspace(req, supabase)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'list')
    const requestedWorkspace = String(body.workspace_id || auth.workspaceId)
    if (requestedWorkspace !== auth.workspaceId) return json({ error: 'workspace_mismatch' }, 403)
    const workspaceId = auth.workspaceId

    if (action === 'list') {
      const { data, error } = await supabase.from('meta_connections')
        .select('id,connection_type,display_name,status,meta_business_id,page_id,instagram_account_id,scopes,token_secret_name,token_expires_at,last_sync_at,last_error,metadata,created_at,updated_at')
        .eq('workspace_id', workspaceId).neq('page_id', '179969831856298').order('updated_at', { ascending: false })
      if (error) throw error
      return json({ connections: (data ?? []).filter((row) => String(row.display_name || '').toLowerCase().includes('za media')) })
    }

    if (action === 'create' || action === 'upsert') {
      const pageId = String(body.page_id || '').trim()
      const appId = String(body.app_id || META_APP_ID || '').trim()
      if (!pageId) return json({ error: 'page_id_required' }, 400)
      if (!appId) return json({ error: 'app_id_required' }, 400)
      if (BLOCKED_PAGE_IDS.has(pageId)) return json({ error: 'blocked_page_id' }, 403)
      if (BLOCKED_APP_IDS.has(appId)) return json({ error: 'blocked_app_id' }, 403)
      if (META_APP_ID && appId !== META_APP_ID) return json({ error: 'app_id_mismatch' }, 403)
      const displayName = String(body.display_name || 'ZA Media Meta').trim()
      if (!displayName.toLowerCase().includes('za media')) return json({ error: 'za_media_identity_required' }, 403)

      const { data: existing, error: lookupError } = await supabase.from('meta_connections').select('id').eq('workspace_id', workspaceId).eq('page_id', pageId).maybeSingle()
      if (lookupError) throw lookupError
      const payload = {
        connection_type: 'facebook_page', display_name: displayName, status: 'pending', page_id: pageId,
        meta_business_id: body.meta_business_id ? String(body.meta_business_id) : null,
        instagram_account_id: body.instagram_account_id ? String(body.instagram_account_id) : null,
        scopes: Array.isArray(body.scopes) ? body.scopes.slice(0, 50).map(String) : [],
        token_secret_name: 'META_PAGE_ACCESS_TOKEN',
        metadata: { ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}), brand: 'ZA Media', authorization_required: true },
        workspace_id: workspaceId, updated_at: new Date().toISOString(),
      }
      const query = existing
        ? supabase.from('meta_connections').update(payload).eq('id', existing.id).eq('workspace_id', workspaceId).select().single()
        : supabase.from('meta_connections').insert(payload).select().single()
      const { data, error } = await query
      if (error) throw error
      await audit(supabase, 'meta_connection_upserted', { page_id: pageId, app_id: appId, connection_id: data.id }, workspaceId)
      return json({ success: true, connection: data })
    }

    if (action === 'verify') {
      const pageId = String(body.page_id || '').trim()
      if (!pageId) return json({ error: 'page_id_required' }, 400)
      if (BLOCKED_PAGE_IDS.has(pageId)) return json({ error: 'blocked_page_id' }, 403)
      if (!META_PAGE_ACCESS_TOKEN) return json({ status: 'BLOCKED_BY_HUMAN_ACTION', required_action: 'Configure META_PAGE_ACCESS_TOKEN server-side' }, 403)
      const { data: connection, error: lookupError } = await supabase.from('meta_connections').select('id,workspace_id,page_id,display_name,metadata').eq('workspace_id', workspaceId).eq('page_id', pageId).maybeSingle()
      if (lookupError) throw lookupError
      if (!connection || !String(connection.display_name || '').toLowerCase().includes('za media')) return json({ error: 'za_media_connection_required' }, 403)

      const res = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(pageId)}?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(META_PAGE_ACCESS_TOKEN)}`)
      const data = await res.json()
      if (!res.ok || data?.error || String(data?.id || '') !== pageId) {
        await audit(supabase, 'meta_connection_verify_failed', { page_id: pageId, reason: data?.error ?? 'page_identity_mismatch' }, workspaceId)
        return json({ error: 'verification_failed' }, 502)
      }

      const { error: updateError } = await supabase.from('meta_connections').update({
        status: 'verified', display_name: `ZA Media Meta — ${String(data.name || 'Page')}`,
        instagram_account_id: data.instagram_business_account?.id ? String(data.instagram_business_account.id) : null,
        metadata: { ...(connection.metadata ?? {}), brand: 'ZA Media', graph_verified_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id).eq('workspace_id', workspaceId)
      if (updateError) throw updateError
      await audit(supabase, 'meta_connection_verified', { page_id: pageId, page_name: data.name ?? null, instagram_account_id: data.instagram_business_account?.id ?? null }, workspaceId)
      return json({ success: true, verified: true, page: { id: data.id, name: data.name, instagram_business_account: data.instagram_business_account ?? null } })
    }

    return json({ error: 'unknown_action', supported_actions: ['list', 'create', 'upsert', 'verify'] }, 400)
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: 'internal_error' }, 500)
  }
})