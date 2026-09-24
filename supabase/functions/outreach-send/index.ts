import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function unauthorized(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status: 401, headers: { 'Content-Type': 'application/json' } })
}
async function requireProspectWorkspaceAccess(req: Request, supabase: ReturnType<typeof createClient>, prospectId: string) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw unauthorized('Authentication required')
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) throw unauthorized('Authentication required')
  const { data: profile, error: profileError } = await supabase.from('prospect_profiles').select('workspace_id').eq('id', prospectId).maybeSingle()
  if (profileError) throw profileError
  if (!profile?.workspace_id) throw unauthorized('Unauthorized')
  const { data: membership, error: membershipError } = await supabase.from('workspace_members').select('workspace_id').eq('workspace_id', profile.workspace_id).eq('user_id', authData.user.id).maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) throw unauthorized('Unauthorized')
  return { userId: authData.user.id, workspaceId: profile.workspace_id as string }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const AGENTMAIL_API = 'https://api.agentmail.to/v0'
const AGENTMAIL_INBOX_ID = Deno.env.get('AGENTMAIL_INBOX_ID') || 'enjy-4142@agentmail.to'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const agentMailKey = Deno.env.get('AGENTMAIL_API_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Server configuration is missing')
    if (!agentMailKey) return json({ ok: false, reason: 'AGENTMAIL_API_KEY is not configured in Supabase Secrets', send_performed: false }, 503)

    const input = await req.json()
    if (!input.outreach_event_id) throw new Error('outreach_event_id is required')

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: draft, error: draftError } = await supabase
      .from('prospect_outreach_events')
      .select('id,prospect_id,opportunity_id,channel,event_type,content,metadata')
      .eq('id', input.outreach_event_id)
      .single()
    if (draftError) throw draftError
    if (!draft) return json({ ok: false, reason: 'Outreach event not found' }, 404)
    if (draft.channel !== 'email') return json({ ok: false, reason: 'Only email dispatch is implemented for AgentMail', channel: draft.channel }, 409)
    if (draft.event_type !== 'approved') {
      return json({ ok: false, reason: 'Outreach event must be explicitly approved before sending', event_type: draft.event_type }, 409)
    }

    const { workspaceId } = await requireProspectWorkspaceAccess(req, supabase, String(draft.prospect_id))

    const { data: opportunity, error: opportunityError } = await supabase
      .from('prospect_opportunities')
      .select('id,status')
      .eq('id', draft.opportunity_id)
      .eq('prospect_id', draft.prospect_id)
      .eq('workspace_id', workspaceId)
      .single()
    if (opportunityError) throw opportunityError
    if (opportunity.status !== 'approved') {
      return json({ ok: false, reason: 'Opportunity must be approved before external sending', opportunity_status: opportunity.status }, 409)
    }

    const { data: profile, error: profileError } = await supabase
      .from('prospect_profiles')
      .select('id,canonical_name,profile_data')
      .eq('id', draft.prospect_id)
      .eq('workspace_id', workspaceId)
      .single()
    if (profileError) throw profileError

    const profileData = (profile.profile_data ?? {}) as Record<string, unknown>
    let recipient = String(profileData.contact_email ?? '').trim().toLowerCase()
    if (!recipient || !recipient.includes('@')) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('email,is_decision_maker,created_at')
        .eq('company_id', profile.profile_data?.company_id ?? '')
        .eq('workspace_id', workspaceId)
        .not('email', 'is', null)
        .order('is_decision_maker', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      recipient = String(contact?.email ?? '').trim().toLowerCase()
    }
    if (!recipient || !recipient.includes('@')) {
      return json({ ok: false, reason: 'Verified prospect contact_email is missing and no linked contact email is available', send_performed: false }, 409)
    }

    const { data: suppressed, error: suppressionError } = await supabase
      .rpc('is_outreach_suppressed', { target_workspace_id: workspaceId, target_email: recipient })
    if (suppressionError) throw suppressionError
    if (suppressed === true) {
      await supabase.from('audit_logs').insert({
        action: 'personalized_outreach_suppressed',
        resource_type: 'prospect_outreach_events',
        resource_id: draft.id,
        metadata: { prospect_id: draft.prospect_id, opportunity_id: draft.opportunity_id, recipient, provider: 'agentmail' },
      })
      return json({ ok: false, reason: 'Recipient is suppressed; external send blocked', send_performed: false, suppressed: true }, 409)
    }

    const { data: existingSent } = await supabase
      .from('prospect_outreach_events')
      .select('id,metadata,occurred_at')
      .eq('prospect_id', draft.prospect_id)
      .eq('opportunity_id', draft.opportunity_id)
      .eq('event_type', 'sent')
      .contains('metadata', { source_draft_event_id: draft.id })
      .limit(1)
    if (existingSent?.length) {
      return json({ ok: true, duplicate: true, send_performed: false, sent_event: existingSent[0] })
    }

    const metadata = (draft.metadata ?? {}) as Record<string, unknown>
    const subject = String(metadata.subject ?? 'ZA Media — quick growth review')
    const text = String(draft.content ?? '').trim()
    if (!text) return json({ ok: false, reason: 'Draft body is empty', send_performed: false }, 409)

    const idempotencyKey = `za-outreach-${draft.id}`
    const response = await fetch(`${AGENTMAIL_API}/inboxes/${encodeURIComponent(AGENTMAIL_INBOX_ID)}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${agentMailKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ to: [recipient], subject, text }),
    })

    const responseText = await response.text()
    if (!response.ok) {
      await supabase.from('audit_logs').insert({
        action: 'personalized_outreach_send_failed',
        resource_type: 'prospect_outreach_events',
        resource_id: draft.id,
        metadata: {
          prospect_id: draft.prospect_id,
          opportunity_id: draft.opportunity_id,
          recipient,
          provider: 'agentmail',
          status: response.status,
          error: responseText.slice(0, 1000),
        },
      })
      return json({ ok: false, reason: 'AgentMail send failed', provider_status: response.status, send_performed: false }, 502)
    }

    const provider = JSON.parse(responseText)
    const { data: sentEvent, error: sentError } = await supabase
      .from('prospect_outreach_events')
      .insert({
        prospect_id: draft.prospect_id,
        opportunity_id: draft.opportunity_id,
        workspace_id: workspaceId,
        channel: 'email',
        event_type: 'sent',
        content: text,
        metadata: {
          source_draft_event_id: draft.id,
          provider: 'agentmail',
          provider_message_id: provider?.message_id ?? null,
          provider_thread_id: provider?.thread_id ?? null,
          recipient,
          subject,
          send_performed: true,
          idempotency_key: idempotencyKey,
        },
      })
      .select('id,prospect_id,opportunity_id,channel,event_type,metadata,occurred_at')
      .single()
    if (sentError) throw sentError

    await supabase.from('audit_logs').insert({
      action: 'personalized_outreach_sent',
      resource_type: 'prospect_outreach_events',
      resource_id: sentEvent.id,
      metadata: {
        prospect_id: draft.prospect_id,
        opportunity_id: draft.opportunity_id,
        source_draft_event_id: draft.id,
        provider: 'agentmail',
        provider_message_id: provider?.message_id ?? null,
        provider_thread_id: provider?.thread_id ?? null,
        recipient,
        send_performed: true,
      },
    })

    return json({
      ok: true,
      send_performed: true,
      provider: 'agentmail',
      provider_message_id: provider?.message_id ?? null,
      provider_thread_id: provider?.thread_id ?? null,
      sent_event: sentEvent,
    })
  } catch (error) {
    if (error instanceof Response) return error
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error', send_performed: false }, 400)
  }
})