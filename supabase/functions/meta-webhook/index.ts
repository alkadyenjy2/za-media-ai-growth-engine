import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BLOCKED_PAGE_IDS = new Set(['179969831856298'])
const BLOCKED_FORM_IDS = new Set(['1117890449167883'])
const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN')
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')
const META_INTERNAL_SECRET = Deno.env.get('META_INTERNAL_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}

async function verifySignature(payload: string, signature: string, secret: string) {
  if (!signature.startsWith('sha256=') || !secret) return false
  const expected = signature.slice(7).toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(expected)) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const actual = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  let diff = actual.length ^ expected.length
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ (expected.charCodeAt(i) || 0)
  return diff === 0
}

async function audit(supabase: ReturnType<typeof createClient>, action: string, details: Record<string, unknown>) {
  const { error } = await supabase.from('audit_logs').insert({ action, entity_type: 'meta_webhook', actor: 'meta-webhook', details })
  if (error) throw error
}

async function delegate(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  if (!META_INTERNAL_SECRET) throw new Error('META_INTERNAL_SECRET not configured')
  const { error } = await supabase.functions.invoke('meta-lead-ingest', {
    body: payload,
    headers: { 'x-za-meta-internal-secret': META_INTERNAL_SECRET },
  })
  if (error) throw error
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response('Supabase server configuration missing', { status: 500 })
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  if (req.method === 'GET') {
    const url = new URL(req.url)
    if (!META_VERIFY_TOKEN) return new Response('META_VERIFY_TOKEN not configured', { status: 500 })
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === META_VERIFY_TOKEN) {
      const challenge = url.searchParams.get('hub.challenge')
      if (challenge) return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!META_APP_SECRET) return new Response('META_APP_SECRET not configured', { status: 500 })
  if (!META_INTERNAL_SECRET) return new Response('META_INTERNAL_SECRET not configured', { status: 500 })

  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256') || ''
  if (!(await verifySignature(rawBody, signature, META_APP_SECRET))) {
    try { await audit(supabase, 'meta_webhook_rejected', { reason: 'invalid_signature' }) } catch { /* preserve 401 */ }
    return new Response('Invalid signature', { status: 401 })
  }

  let body: any
  try { body = JSON.parse(rawBody) } catch {
    try { await audit(supabase, 'meta_webhook_rejected', { reason: 'invalid_json' }) } catch { /* preserve 400 */ }
    return new Response('Invalid JSON', { status: 400 })
  }
  if (body.object !== 'page') return json({ accepted: true, ignored: true })

  const jobs: Promise<unknown>[] = []
  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== 'leadgen') continue
      const value = change.value || {}
      const leadgenId = String(value.leadgen_id || '')
      const pageId = String(value.page_id || entry.id || '')
      const formId = String(value.form_id || '')
      if (!leadgenId || !pageId) continue
      if (BLOCKED_PAGE_IDS.has(pageId) || BLOCKED_FORM_IDS.has(formId)) {
        jobs.push(audit(supabase, 'meta_webhook_blocked', { reason: BLOCKED_PAGE_IDS.has(pageId) ? 'blocked_page_id' : 'blocked_form_id', external_id: leadgenId, page_id: pageId, form_id: formId }))
        continue
      }
      jobs.push((async () => {
        await audit(supabase, 'meta_webhook_received', { external_id: leadgenId, page_id: pageId, form_id: formId })
        await delegate(supabase, { leadgen_id: leadgenId, page_id: pageId, form_id: formId, created_time: value.created_time, source: 'webhook' })
      })().catch(async (error) => {
        try { await audit(supabase, 'meta_webhook_delegate_failed', { external_id: leadgenId, page_id: pageId, form_id: formId, reason: error instanceof Error ? error.message : String(error) }) } catch { /* do not leak internal details */ }
      }))
    }
  }

  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }).EdgeRuntime
  if (edgeRuntime) edgeRuntime.waitUntil(Promise.all(jobs))
  else await Promise.all(jobs)
  return json({ accepted: true })
})