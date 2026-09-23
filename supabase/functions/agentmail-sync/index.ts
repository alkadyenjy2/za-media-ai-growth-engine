import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AGENTMAIL_API = 'https://api.agentmail.to/v0'
const INBOX_ID = Deno.env.get('AGENTMAIL_INBOX_ID') || 'enjy-4142@agentmail.to'
const AGENTMAIL_KEY = Deno.env.get('AGENTMAIL_API_KEY')
const SYNC_SECRET = Deno.env.get('AGENTMAIL_SYNC_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function normalizedEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function isUnsubscribe(text: string) {
  return /(^|\b)(unsubscribe|remove me|remove my email|stop emailing|stop contacting|do not contact|don't contact|take me off|opt[- ]?out)(\b|$)/i.test(text)
}

function isBounce(message: { from?: string; subject?: string; labels?: string[] }) {
  const from = normalizedEmail(message.from)
  const subject = String(message.subject ?? '')
  const labels = (message.labels ?? []).map((x) => x.toLowerCase())
  return from.includes('mailer-daemon') ||
    labels.includes('bounced') ||
    /delivery status|delivery failure|undeliver|mail delivery|returned mail|failure notice/i.test(subject)
}

async function agentmail(path: string, init: RequestInit = {}) {
  if (!AGENTMAIL_KEY) throw new Error('AGENTMAIL_API_KEY is not configured')
  const response = await fetch(AGENTMAIL_API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${AGENTMAIL_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text()
  let body: any = {}
  try { body = text ? JSON.parse(text) : {} } catch { body = { raw: text } }
  if (!response.ok) throw new Error(`AgentMail API ${response.status}: ${text.slice(0, 500)}`)
  return body
}

async function upsertSuppression(supabase: any, workspaceId: string, email: string, reason: string, externalId: string | null, metadata: Record<string, unknown>) {
  const normalized = normalizedEmail(email)
  if (!normalized || normalized === normalizedEmail(INBOX_ID) || normalized.includes('mailer-daemon')) return
  await supabase.from('outreach_suppressions').upsert({
    workspace_id: workspaceId,
    email: normalized,
    reason,
    source: 'agentmail',
    external_id: externalId,
    metadata,
    suppressed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,email' })
}

async function findSentEvent(supabase: any, workspaceId: string, threadId: string | null, inReplyTo: string | null, sender: string) {
  if (threadId) {
    const { data } = await supabase.from('prospect_outreach_events')
      .select('id,prospect_id,opportunity_id,metadata,occurred_at')
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'sent')
      .eq('metadata->>provider_thread_id', threadId)
      .order('occurred_at', { ascending: false }).limit(1).maybeSingle()
    if (data) return data
  }
  if (inReplyTo) {
    const { data } = await supabase.from('prospect_outreach_events')
      .select('id,prospect_id,opportunity_id,metadata,occurred_at')
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'sent')
      .eq('metadata->>provider_message_id', inReplyTo)
      .order('occurred_at', { ascending: false }).limit(1).maybeSingle()
    if (data) return data
  }
  const { data } = await supabase.from('prospect_outreach_events')
    .select('id,prospect_id,opportunity_id,metadata,occurred_at')
    .eq('workspace_id', workspaceId)
    .eq('event_type', 'sent')
    .eq('channel', 'email')
    .eq('metadata->>recipient', sender)
    .gte('occurred_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('occurred_at', { ascending: false }).limit(1).maybeSingle()
  return data ?? null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ ok: false, error: 'server_configuration_missing' }, 500)
  if (!AGENTMAIL_KEY) return json({ ok: false, error: 'AGENTMAIL_API_KEY not configured', status: 'BLOCKED_BY_HUMAN_ACTION' }, 503)
  if (!SYNC_SECRET || req.headers.get('x-za-agentmail-sync-secret') !== SYNC_SECRET) return json({ ok: false, error: 'forbidden' }, 403)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  try {
    const { data: workspace, error: workspaceError } = await supabase.from('workspaces').select('id').eq('slug', 'za-media').single()
    if (workspaceError || !workspace?.id) throw workspaceError ?? new Error('ZA Media workspace not found')
    const workspaceId = workspace.id

    const { data: state } = await supabase.from('integration_sync_state')
      .select('id,cursor_at').eq('workspace_id', workspaceId).eq('provider', 'agentmail').eq('integration_key', INBOX_ID).maybeSingle()

    const after = state?.cursor_at ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    let pageToken: string | undefined
    let processed = 0
    let replies = 0
    let suppressions = 0
    let cursor = after

    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({ limit: '100', after, ascending: 'true' })
      if (pageToken) params.set('page_token', pageToken)
      const result = await agentmail(`/inboxes/${encodeURIComponent(INBOX_ID)}/messages?${params.toString()}`)
      const messages = Array.isArray(result.messages) ? result.messages : []
      if (!messages.length) break

      for (const message of messages) {
        const occurredAt = String(message.timestamp ?? message.createdAt ?? new Date().toISOString())
        if (occurredAt > cursor) cursor = occurredAt
        if (normalizedEmail(message.from) === normalizedEmail(INBOX_ID)) continue

        const bounce = isBounce(message)
        let body = String(message.preview ?? '')
        if (!bounce) {
          const full = await agentmail(`/inboxes/${encodeURIComponent(INBOX_ID)}/messages/${encodeURIComponent(message.messageId)}`)
          body = String(full.text ?? full.extractedText ?? full.html ?? body)
        }

        const sender = normalizedEmail(message.from)
        const eventType = bounce ? 'bounce' : isUnsubscribe(body) ? 'reply' : 'reply'
        const { data: inserted, error: inboundError } = await supabase.from('outreach_inbound_messages').insert({
          workspace_id: workspaceId,
          provider: 'agentmail',
          inbox_id: INBOX_ID,
          message_id: message.messageId,
          thread_id: message.threadId ?? null,
          from_email: sender,
          subject: message.subject ?? null,
          event_type: eventType,
          body: body.slice(0, 20000),
          metadata: {
            labels: message.labels ?? [],
            in_reply_to: message.inReplyTo ?? null,
            references: message.references ?? [],
          },
          occurred_at: occurredAt,
        }).select('id').maybeSingle()

        if (inboundError && !String(inboundError.message).toLowerCase().includes('duplicate')) throw inboundError
        if (!inserted) continue
        processed++

        if (bounce) {
          const emails = Array.from(new Set((body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])
            .map(normalizedEmail)
            .filter((email) => email !== normalizedEmail(INBOX_ID) && !email.includes('mailer-daemon'))))
          for (const email of emails) {
            await upsertSuppression(supabase, workspaceId, email, 'bounce', message.messageId, { subject: message.subject, thread_id: message.threadId })
            suppressions++
          }
        }

        const sent = await findSentEvent(supabase, workspaceId, message.threadId ?? null, message.inReplyTo ?? null, sender)
        if (!sent) {
          await supabase.from('audit_logs').insert({
            workspace_id: workspaceId,
            action: 'agentmail_inbound_unmatched',
            entity_type: 'outreach_inbound_messages',
            entity_id: inserted.id,
            actor: 'agentmail-sync',
            details: { message_id: message.messageId, sender, event_type: eventType, thread_id: message.threadId ?? null },
          })
          continue
        }

        if (bounce) {
          await supabase.from('prospect_outreach_events').insert({
            prospect_id: sent.prospect_id,
            opportunity_id: sent.opportunity_id,
            workspace_id: workspaceId,
            channel: 'email',
            event_type: 'stopped',
            content: body.slice(0, 12000),
            external_id: message.messageId,
            metadata: { source: 'agentmail', reason: 'bounce', provider_thread_id: message.threadId ?? null, source_sent_event_id: sent.id },
          })
        } else {
          await supabase.from('prospect_outreach_events').insert({
            prospect_id: sent.prospect_id,
            opportunity_id: sent.opportunity_id,
            workspace_id: workspaceId,
            channel: 'email',
            event_type: 'replied',
            content: body.slice(0, 12000),
            external_id: message.messageId,
            metadata: {
              source: 'agentmail',
              provider_message_id: message.messageId,
              provider_thread_id: message.threadId ?? null,
              in_reply_to: message.inReplyTo ?? null,
              source_sent_event_id: sent.id,
            },
          })
          replies++
          if (isUnsubscribe(body)) {
            await upsertSuppression(supabase, workspaceId, sender, 'unsubscribe', message.messageId, { subject: message.subject, thread_id: message.threadId })
            suppressions++
            await supabase.from('prospect_outreach_events').insert({
              prospect_id: sent.prospect_id,
              opportunity_id: sent.opportunity_id,
              workspace_id: workspaceId,
              channel: 'email',
              event_type: 'unsubscribe',
              content: body.slice(0, 12000),
              external_id: message.messageId,
              metadata: { source: 'agentmail', source_sent_event_id: sent.id },
            })
          }
          await supabase.from('prospect_profiles').update({ lifecycle_status: 'engaged', updated_at: new Date().toISOString() }).eq('id', sent.prospect_id).eq('workspace_id', workspaceId)
        }
      }

      pageToken = result.next_page_token
      if (!pageToken) break
    }

    const cursorDate = new Date(cursor)
    const safeCursor = Number.isNaN(cursorDate.getTime()) ? new Date().toISOString() : new Date(cursorDate.getTime() + 1).toISOString()
    const syncPayload = {
      workspace_id: workspaceId,
      provider: 'agentmail',
      integration_key: INBOX_ID,
      cursor_at: safeCursor,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('integration_sync_state').upsert(syncPayload, { onConflict: 'workspace_id,provider,integration_key' })
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      action: 'agentmail_inbound_sync',
      entity_type: 'integration_sync_state',
      actor: 'agentmail-sync',
      details: { inbox_id: INBOX_ID, after, cursor_at: safeCursor, processed, replies, suppressions },
    })

    return json({ ok: true, inbox_id: INBOX_ID, after, cursor_at: safeCursor, processed, replies, suppressions })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})