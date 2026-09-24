import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
function unauthorized(message = 'Authentication required') { return json({ ok: false, error: message }, 401) }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Server configuration is missing' }, 500)
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return unauthorized()
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) return unauthorized()
    const input = await req.json()
    const draftId = String(input.outreach_event_id ?? '').trim()
    if (!draftId) return json({ ok: false, error: 'outreach_event_id is required' }, 400)

    const { data: draft, error: draftError } = await supabase.from('prospect_outreach_events')
      .select('id,prospect_id,opportunity_id,workspace_id,channel,event_type,content,metadata')
      .eq('id', draftId).single()
    if (draftError) throw draftError
    if (!draft.workspace_id || !draft.prospect_id) return json({ ok: false, error: 'Invalid outreach event' }, 409)
    if (!['drafted', 'reviewed'].includes(draft.event_type)) return json({ ok: false, error: 'Only drafted/reviewed outreach can be approved', event_type: draft.event_type }, 409)

    const { data: membership, error: membershipError } = await supabase.from('workspace_members')
      .select('workspace_id').eq('workspace_id', draft.workspace_id).eq('user_id', authData.user.id).maybeSingle()
    if (membershipError) throw membershipError
    if (!membership) return unauthorized('Unauthorized')
    if (draft.channel !== 'email') return json({ ok: false, error: 'Only email approval is wired to the current outbound dispatcher', channel: draft.channel }, 409)

    const { data: opportunity, error: opportunityError } = await supabase.from('prospect_opportunities')
      .select('id,status').eq('id', draft.opportunity_id).eq('prospect_id', draft.prospect_id).eq('workspace_id', draft.workspace_id).single()
    if (opportunityError) throw opportunityError
    if (!['identified', 'reviewed', 'approved'].includes(opportunity.status)) return json({ ok: false, error: 'Opportunity is not eligible for approval', opportunity_status: opportunity.status }, 409)

    const { data: existingApproved } = await supabase.from('prospect_outreach_events')
      .select('id,metadata,occurred_at').eq('prospect_id', draft.prospect_id).eq('opportunity_id', draft.opportunity_id)
      .eq('event_type', 'approved').contains('metadata', { source_draft_event_id: draft.id }).limit(1)
    if (existingApproved?.length) return json({ ok: true, already_approved: true, approved_event: existingApproved[0] })

    const metadata = (draft.metadata ?? {}) as Record<string, unknown>
    const approvalReason = String(input.reason ?? 'Human approval')
    const approvedMetadata = {
      ...metadata, source_draft_event_id: draft.id, approval_reason: approvalReason,
      approved_by_user_id: authData.user.id, approved_at: new Date().toISOString(), human_approval_required: true,
    }
    const { data: approvedEvent, error: approvedError } = await supabase.from('prospect_outreach_events').insert({
      prospect_id: draft.prospect_id, opportunity_id: draft.opportunity_id, workspace_id: draft.workspace_id,
      channel: draft.channel, event_type: 'approved', content: draft.content, external_id: null, metadata: approvedMetadata,
    }).select('id,prospect_id,opportunity_id,workspace_id,channel,event_type,content,metadata,occurred_at').single()
    if (approvedError) throw approvedError

    if (opportunity.status !== 'approved') {
      const { error: updateError } = await supabase.from('prospect_opportunities')
        .update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', opportunity.id).eq('workspace_id', draft.workspace_id)
      if (updateError) throw updateError
    }

    await supabase.from('audit_logs').insert({
      workspace_id: draft.workspace_id, action: 'outreach_approved', entity_type: 'prospect_outreach_events',
      entity_id: approvedEvent.id, actor: authData.user.id,
      details: { prospect_id: draft.prospect_id, opportunity_id: draft.opportunity_id, source_draft_event_id: draft.id,
        channel: draft.channel, approval_reason: approvalReason, human_approval_required: true, send_performed: false },
    })
    return json({ ok: true, approved: true, send_performed: false, approved_event: approvedEvent, next_action: 'Call outreach-send with the approved_event.id after human review is complete.' })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 400)
  }
})