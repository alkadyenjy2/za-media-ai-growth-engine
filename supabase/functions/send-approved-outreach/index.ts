import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireProspectWorkspaceAccess } from '../_shared/workspace-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

const AGENTMAIL_API = 'https://api.agentmail.to/v0'

type OutreachEvent = {
  id: string
  prospect_id: string
  opportunity_id: string | null
  channel: string
  event_type: string
  content: string | null
  metadata: Record<string, unknown> | null
}

function getString(record: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

async function sendAgentMail(apiKey: string, inboxId: string, to: string, subject: string, text: string, idempotencyKey: string) {
  const response = await fetch(
    `${AGENTMAIL_API}/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ to: [to], subject, text }),
    },
  )

  const raw = await response.text()
  let payload: Record<string, unknown> = {}
  try {
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    payload = { raw: raw.slice(0, 1000) }
  }

  if (!response.ok) {
    throw new Error(`AgentMail send failed (${response.status}): ${JSON.stringify(payload).slice(0, 1200)}`)
  }

  return payload as { message_id?: string; thread_id?: string }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const agentMailKey = Deno.env.get('AGENTMAIL_API_KEY')
    const inboxId = Deno.env.get('AGENTMAIL_INBOX_ID') ?? 'enjy-4142@agentmail.to'

    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')
    if (!agentMailKey) throw new Error('AGENTMAIL_API_KEY is not configured')

    const input = await req.json()
    const outreachEventId = String(input.outreach_event_id ?? '')
    if (!outreachEventId) throw new Error('outreach_event_id is required')

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: event, error: eventError } = await supabase
      .from('prospect_outreach_events')
      .select('id,prospect_id,opportunity_id,channel,event_type,content,metadata')
      .eq('id', outreachEventId)
      .single()

    if (eventError) throw eventError
    const outreach = event as OutreachEvent

    const { workspaceId } = await requireProspectWorkspaceAccess(req, supabase, outreach.prospect_id)

    if (outreach.event_type !== 'approved') {
      return json({ ok: false, reason: 'Outreach event is not approved', outreach_event_id: outreach.id }, 409)
    }
    if (outreach.channel !== 'email') {
      return json({ ok: false, reason: 'AgentMail adapter currently supports email only', channel: outreach.channel }, 409)
    }
    if (!outreach.content?.trim()) {
      return json({ ok: false, reason: 'Approved outreach has no message body' }, 409)
    }

    const metadata = outreach.metadata ?? {}
    if (metadata.execution_status === 'sent') {
      return json({
        ok: true,
        already_sent: true,
        outreach_event_id: outreach.id,
        provider_message_id: metadata.provider_message_id ?? null,
        provider_thread_id: metadata.provider_thread_id ?? null,
      })
    }
    if (metadata.execution_status === 'sending') {
      return json({ ok: false, reason: 'Outreach execution is already in progress', outreach_event_id: outreach.id }, 409)
    }

    const { data: profile, error: profileError } = await supabase
      .from('prospect_profiles')
      .select('id,canonical_name,workspace_id,profile_data')
      .eq('id', outreach.prospect_id)
      .single()
    if (profileError) throw profileError

    const profileData = (profile.profile_data ?? {}) as Record<string, unknown>
    const recipient = getString(profileData, ['contact_email', 'email', 'primary_email'])
    if (!recipient) {
      return json({ ok: false, reason: 'No verified prospect email is stored for this approved outreach' }, 409)
    }

    const subject = getString(metadata, ['subject']) ?? `ZA Media — ${profile.canonical_name}`
    const idempotencyKey = `za-outreach-${outreach.id}`

    const sendingMetadata = {
      ...metadata,
      execution_status: 'sending',
      execution_started_at: new Date().toISOString(),
      provider: 'agentmail',
      provider_inbox_id: inboxId,
      recipient,
    }

    const { error: markSendingError } = await supabase
      .from('prospect_outreach_events')
      .update({ metadata: sendingMetadata })
      .eq('id', outreach.id)
    if (markSendingError) throw markSendingError

    try {
      const sent = await sendAgentMail(agentMailKey, inboxId, recipient, subject, outreach.content, idempotencyKey)
      const providerMessageId = sent.message_id ?? null
      const providerThreadId = sent.thread_id ?? null
      const completedAt = new Date().toISOString()

      const { data: sentEvent, error: sentEventError } = await supabase
        .from('prospect_outreach_events')
        .insert({
          prospect_id: outreach.prospect_id,
          opportunity_id: outreach.opportunity_id,
          channel: 'email',
          event_type: 'sent',
          content: outreach.content,
          metadata: {
            source_event_id: outreach.id,
            provider: 'agentmail',
            provider_message_id: providerMessageId,
            provider_thread_id: providerThreadId,
            inbox_id: inboxId,
            recipient,
            subject,
            idempotency_key: idempotencyKey,
            send_performed: true,
            sent_at: completedAt,
          },
        })
        .select('id,prospect_id,opportunity_id,channel,event_type,metadata,occurred_at')
        .single()
      if (sentEventError) throw sentEventError

      const { error: finalizeError } = await supabase
        .from('prospect_outreach_events')
        .update({
          metadata: {
            ...sendingMetadata,
            execution_status: 'sent',
            execution_completed_at: completedAt,
            provider_message_id: providerMessageId,
            provider_thread_id: providerThreadId,
            sent_event_id: sentEvent.id,
          },
        })
        .eq('id', outreach.id)
        .eq('workspace_id', workspaceId)
      if (finalizeError) throw finalizeError

      await supabase.from('audit_logs').insert({
        action: 'personalized_outreach_sent',
        resource_type: 'prospect_outreach_events',
        resource_id: sentEvent.id,
        metadata: {
          prospect_id: outreach.prospect_id,
          opportunity_id: outreach.opportunity_id,
          source_event_id: outreach.id,
          channel: 'email',
          provider: 'agentmail',
          provider_message_id: providerMessageId,
          provider_thread_id: providerThreadId,
          recipient,
          evidence_backed: true,
        },
      })

      return json({
        ok: true,
        sent: true,
        outreach_event_id: outreach.id,
        sent_event_id: sentEvent.id,
        provider_message_id: providerMessageId,
        provider_thread_id: providerThreadId,
      })
    } catch (sendError) {
      const failedAt = new Date().toISOString()
      await supabase
        .from('prospect_outreach_events')
        .update({
          metadata: {
            ...sendingMetadata,
            execution_status: 'failed',
            execution_failed_at: failedAt,
            execution_error: sendError instanceof Error ? sendError.message : String(sendError),
          },
        })
        .eq('id', outreach.id)
        .eq('workspace_id', workspaceId)

      await supabase.from('audit_logs').insert({
        action: 'personalized_outreach_send_failed',
        resource_type: 'prospect_outreach_events',
        resource_id: outreach.id,
        metadata: {
          prospect_id: outreach.prospect_id,
          opportunity_id: outreach.opportunity_id,
          provider: 'agentmail',
          recipient,
          error: sendError instanceof Error ? sendError.message : String(sendError),
        },
      })

      throw sendError
    }
  } catch (error) {
    if (error instanceof Response) return error
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 400)
  }
})
