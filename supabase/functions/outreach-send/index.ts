import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

function unauthorized(status: 401 | 403, message: string) {
  return json({ ok: false, error: message }, status)
}

async function requireProspectWorkspaceAccess(req: Request, supabase: ReturnType<typeof createClient>, prospectId: string) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw unauthorized(401, 'Authentication required')
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) throw unauthorized(401, 'Authentication required')
  const { data: profile, error: profileError } = await supabase.from('prospect_profiles').select('workspace_id').eq('id', prospectId).maybeSingle()
  if (profileError) throw profileError
  if (!profile?.workspace_id) throw unauthorized(403, 'Unauthorized')
  const { data: membership, error: membershipError } = await supabase.from('workspace_members').select('workspace_id').eq('workspace_id', profile.workspace_id).eq('user_id', authData.user.id).maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) throw unauthorized(403, 'Unauthorized')
  return { userId: authData.user.id, workspaceId: profile.workspace_id as string }
}

async function sendAgentMail(apiKey: string, inboxId: string, to: string, subject: string, text: string) {
  const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: [to], subject, text }),
  })
  const bodyText = await response.text()
  let body: Record<string, unknown> = {}
  try { body = bodyText ? JSON.parse(bodyText) : {} } catch { body = { raw: bodyText.slice(0, 1000) } }
  if (!response.ok) {
    const code = typeof body.code === 'string' ? body.code : undefined
    throw new Error(`AgentMail send failed (${response.status})${code ? ` [${code}]` : ''}`)
  }
  return body as { message_id?: string; thread_id?: string }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const agentMailApiKey = Deno.env.get('AGENTMAIL_API_KEY')
    const agentMailInboxId = Deno.env.get('AGENTMAIL_INBOX_ID') ?? 'enjy-4142@agentmail.to'
    if (!supabaseUrl || !serviceRoleKey || !agentMailApiKey) {
      return json({ ok: false, error: 'Server configuration is missing', missing: { AGENTMAIL_API_KEY: !agentMailApiKey } }, 503)
    }
    const input = await req.json()
    const outreachEventId = String(input.outreach_event_id ?? '')
    if (!outreachEventId) return json({ ok: false, error: 'outreach_event_id is required' }, 400)
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: event, error: eventError } = await supabase.from('prospect_outreach_events').select('id, prospect_id, opportunity_id, channel, event_type, content, metadata, external_id, workspace_id, occurred_at').eq('id', outreachEventId).single()
    if (eventError) throw eventError
    const { workspaceId, userId } = await requireProspectWorkspaceAccess(req, supabase, event.prospect_id)
    if (event.workspace_id !== workspaceId) return unauthorized(403, 'Unauthorized')
    if (event.channel !== 'email') return json({ ok: false, reason: 'AgentMail dispatcher currently supports email only' }, 409)
    if (event.event_type !== 'approved') return json({ ok: false, reason: 'Explicit human approval is required before dispatch', current_event_type: event.event_type }, 409)
    const metadata = (event.metadata ?? {}) as Record<string, unknown>
    if (event.external_id || metadata.dispatch_status === 'sent') return json({ ok: false, reason: 'Outreach event was already sent', outreach_event_id: event.id }, 409)
    if (metadata.dispatch_status === 'sending') return json({ ok: false, reason: 'Dispatch is already in progress or requires recovery review', outreach_event_id: event.id }, 409)
    const { data: profile, error: profileError } = await supabase.from('prospect_profiles').select('id, canonical_name, profile_data').eq('id', event.prospect_id).eq('workspace_id', workspaceId).single()
    if (profileError) throw profileError
    const profileData = (profile.profile_data ?? {}) as Record<string, unknown>
    const recipient = typeof profileData.contact_email === 'string' ? profileData.contact_email.trim().toLowerCase() : ''
    if (!recipient || !recipient.includes('@')) return json({ ok: false, reason: 'No verified prospect contact email is available' }, 409)
    const { data: suppression } = await supabase.from('outreach_suppressions').select('id, reason').eq('workspace_id', workspaceId).eq('email', recipient).limit(1).maybeSingle()
    if (suppression) return json({ ok: false, reason: 'Recipient is suppressed from outreach', suppression_reason: suppression.reason }, 409)
    const subject = typeof metadata.subject === 'string' && metadata.subject.trim() ? metadata.subject.trim() : `ZA Media — ${profile.canonical_name}`
    const content = typeof event.content === 'string' ? event.content.trim() : ''
    if (!content) return json({ ok: false, reason: 'Approved outreach event has empty content' }, 409)
    const claimedMetadata = { ...metadata, dispatch_status: 'sending', dispatch_started_at: new Date().toISOString(), dispatch_started_by: userId, provider: 'agentmail', inbox_id: agentMailInboxId }
    const { data: claimed, error: claimError } = await supabase.from('prospect_outreach_events').update({ metadata: claimedMetadata }).eq('id', event.id).eq('workspace_id', workspaceId).eq('event_type', 'approved').is('external_id', null).select('id').maybeSingle()
    if (claimError) throw claimError
    if (!claimed) return json({ ok: false, reason: 'Outreach event could not be claimed for dispatch; it may have changed concurrently' }, 409)
    let providerResult: { message_id?: string; thread_id?: string }
    try { providerResult = await sendAgentMail(agentMailApiKey, agentMailInboxId, recipient, subject, content) } catch (sendError) {
      await supabase.from('prospect_outreach_events').update({ metadata: { ...claimedMetadata, dispatch_status: 'failed', dispatch_failed_at: new Date().toISOString(), dispatch_error: sendError instanceof Error ? sendError.message : 'Unknown AgentMail error' } }).eq('id', event.id).eq('workspace_id', workspaceId)
      throw sendError
    }
    const messageId = typeof providerResult.message_id === 'string' ? providerResult.message_id : null
    const threadId = typeof providerResult.thread_id === 'string' ? providerResult.thread_id : null
    if (!messageId) throw new Error('AgentMail returned no message_id')
    const sentMetadata = { ...claimedMetadata, dispatch_status: 'sent', sent_at: new Date().toISOString(), provider_message_id: messageId, provider_thread_id: threadId, provider: 'agentmail' }
    const { data: sentEvent, error: sentError } = await supabase.from('prospect_outreach_events').update({ event_type: 'sent', external_id: messageId, metadata: sentMetadata, occurred_at: new Date().toISOString() }).eq('id', event.id).eq('workspace_id', workspaceId).is('external_id', null).select('id,prospect_id,opportunity_id,channel,event_type,external_id,metadata,occurred_at').single()
    if (sentError) throw sentError
    await supabase.from('audit_logs').insert({ workspace_id: workspaceId, action: 'personalized_outreach_sent', entity_type: 'prospect_outreach_events', entity_id: event.id, actor: 'agentmail_dispatcher', details: { prospect_id: event.prospect_id, opportunity_id: event.opportunity_id, recipient, provider: 'agentmail', provider_message_id: messageId, provider_thread_id: threadId, approved_by_user_id: userId } })
    return json({ ok: true, send_performed: true, provider: 'agentmail', message_id: messageId, thread_id: threadId, outreach_event: sentEvent })
  } catch (error) {
    if (error instanceof Response) return error
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 400)
  }
})