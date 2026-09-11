import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders })
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']

type Evidence = {
  id: string
  evidence_type: string
  source_url: string | null
  claim: string
  evidence_data: Record<string, unknown>
  confidence: number | null
  observed_at: string
  evidence_status?: string
}

type Draft = {
  subject?: string
  body: string
  personalization_claims: string[]
  cta: string
  risk_flags: string[]
}

async function gemini(key: string, prompt: string) {
  let last = 'Gemini request failed'
  for (const model of GEMINI_MODELS) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.15, responseMimeType: 'application/json' },
      }),
    })
    if (response.ok) {
      const payload = await response.json()
      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Gemini returned no candidate text')
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start < 0 || end < start) throw new Error('Gemini returned non-JSON output')
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    const body = await response.text()
    last = `Gemini ${model} failed (${response.status}): ${body.slice(0, 500)}`
    if (![400, 404].includes(response.status)) break
  }
  throw new Error(last)
}

function cleanDraft(draft: Draft, evidence: Evidence[]) {
  const sourceClaims = new Set(evidence.map((e) => e.claim))
  const allowedClaims = (draft.personalization_claims ?? []).filter((claim) =>
    Array.from(sourceClaims).some((source) => source.toLowerCase().includes(String(claim).toLowerCase()) || String(claim).toLowerCase().includes(source.toLowerCase().slice(0, 80)))
  )
  const riskFlags = Array.from(new Set([...(draft.risk_flags ?? [])]))
  if (!draft.body?.trim()) riskFlags.push('empty_body')
  if (draft.body && /guarantee|guaranteed|100%|will increase|will double|certain to/i.test(draft.body)) riskFlags.push('unsupported_guarantee_language')
  if (draft.body && /\b(health|religion|race|ethnicity|politics|political|medical condition)\b/i.test(draft.body)) riskFlags.push('sensitive_attribute_reference')
  return { ...draft, personalization_claims: allowedClaims, risk_flags: Array.from(new Set(riskFlags)) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!supabaseUrl || !serviceRoleKey || !geminiKey) throw new Error('Server configuration is missing')

    const input = await req.json()
    if (!input.prospect_id) throw new Error('prospect_id is required')
    const channel = String(input.channel ?? 'email').toLowerCase()
    if (!['email', 'facebook', 'instagram', 'whatsapp', 'phone'].includes(channel)) throw new Error('Unsupported outreach channel')
    const requestedOpportunityId = input.opportunity_id ?? null

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: profile, error: profileError } = await supabase
      .from('prospect_profiles')
      .select('id,canonical_name,legal_name,website_url,domain,industry,sub_industry,country,city,description,fit_score,intent_score,opportunity_score,confidence_score,profile_data')
      .eq('id', input.prospect_id)
      .single()
    if (profileError) throw profileError

    let opportunityQuery = supabase.from('prospect_opportunities').select('*').eq('prospect_id', profile.id).in('status', ['identified', 'reviewed', 'approved', 'active']).order('opportunity_score', { ascending: false }).limit(1)
    if (requestedOpportunityId) opportunityQuery = supabase.from('prospect_opportunities').select('*').eq('id', requestedOpportunityId).eq('prospect_id', profile.id).limit(1)
    const { data: opportunities, error: opportunityError } = await opportunityQuery
    if (opportunityError) throw opportunityError
    const opportunity = opportunities?.[0]
    if (!opportunity) return json({ ok: false, reason: 'No active opportunity exists for this prospect. Run opportunity-engine first.', prospect_id: profile.id }, 409)

    const { data: matches, error: matchError } = await supabase.from('prospect_service_matches').select('*').eq('opportunity_id', opportunity.id).order('fit_score', { ascending: false }).limit(3)
    if (matchError) throw matchError
    if (!matches?.length) return json({ ok: false, reason: 'No service match exists for this opportunity. Run service matching first.', prospect_id: profile.id, opportunity_id: opportunity.id }, 409)

    const { data: evidenceRows, error: evidenceError } = await supabase
      .from('prospect_evidence')
      .select('id,evidence_type,source_url,claim,evidence_data,confidence,observed_at,evidence_status')
      .eq('prospect_id', profile.id)
      .eq('evidence_status', 'active')
      .order('observed_at', { ascending: false })
      .limit(40)
    if (evidenceError) throw evidenceError
    const evidence = (evidenceRows ?? []) as Evidence[]
    if (!evidence.length) return json({ ok: false, reason: 'No active evidence exists for personalization.', prospect_id: profile.id }, 409)

    const contact = (profile.profile_data ?? {}) as Record<string, unknown>
    const prompt = `You are the outreach drafting layer for ZA Media. Create ONE concise personalized ${channel} outreach draft grounded only in the supplied structured facts.

NON-NEGOTIABLE RULES:
- Never invent a person, job title, email address, phone number, company fact, result, customer, metric, or event.
- Personalization must reference only verifiable evidence claims supplied below.
- Do not infer sensitive attributes or mention health, religion, race/ethnicity, politics, or other sensitive traits.
- Do not promise outcomes or use guaranteed/unsupported performance claims.
- Lead with the prospect's situation/opportunity before pitching.
- Mention the matched ZA Media service naturally, not as a generic capability dump.
- Keep the CTA low-friction: offer a quick review, send a few observations, or ask whether the topic is relevant; do not assume a meeting is desired.
- This is a DRAFT ONLY. Never write as if already sent or approved.
- For email, keep the body under 140 words. For WhatsApp/Instagram/Facebook under 90 words. For phone, provide a short opening script under 110 words.
- Return JSON only with: subject (email only), body, personalization_claims (array of exact-ish claims grounded in evidence), cta, risk_flags (array).

PROSPECT:
${JSON.stringify({ name: profile.canonical_name, industry: profile.industry, sub_industry: profile.sub_industry, city: profile.city, country: profile.country, description: profile.description, website: profile.website_url, fit_score: profile.fit_score, intent_score: profile.intent_score, opportunity_score: profile.opportunity_score, contact: { name: contact.contact_name ?? null, role: contact.contact_role ?? null } }, null, 2)}

OPPORTUNITY:
${JSON.stringify({ type: opportunity.opportunity_type, problem: opportunity.problem, business_impact: opportunity.business_impact, score: opportunity.opportunity_score, data: opportunity.opportunity_data }, null, 2)}

SERVICE MATCHES:
${JSON.stringify(matches.map((m) => ({ service_name: m.service_name, offer_name: m.offer_name, rationale: m.rationale, expected_outcome: m.expected_outcome, fit_score: m.fit_score, match_data: m.match_data })), null, 2)}

EVIDENCE:
${JSON.stringify(evidence.map((e) => ({ id: e.id, type: e.evidence_type, claim: e.claim, source_url: e.source_url, confidence: e.confidence, observed_at: e.observed_at, data: e.evidence_data })), null, 2)}`

    const rawDraft = await gemini(geminiKey, prompt) as Draft
    const draft = cleanDraft(rawDraft, evidence)
    const personalizationEvidenceIds = evidence.filter((e) => (draft.personalization_claims ?? []).some((claim) => claim.toLowerCase().includes(e.claim.toLowerCase().slice(0, 60)) || e.claim.toLowerCase().includes(String(claim).toLowerCase()))).map((e) => e.id)

    const compliance = {
      human_approval_required: true,
      send_performed: false,
      evidence_grounded: (draft.personalization_claims ?? []).length > 0,
      unsupported_claims_detected: (draft.risk_flags ?? []).some((x) => x.includes('unsupported') || x.includes('guarantee')),
      opt_out_protection_required: channel === 'email',
      deliverability_check_required: channel === 'email',
      external_contact_verified: Boolean(contact.contact_email || contact.contact_name),
      note: 'Draft generation only. No external message was sent.',
    }

    const { data: event, error: insertError } = await supabase.from('prospect_outreach_events').insert({
      prospect_id: profile.id,
      opportunity_id: opportunity.id,
      channel,
      event_type: 'drafted',
      content: draft.body,
      metadata: {
        subject: draft.subject ?? null,
        cta: draft.cta,
        personalization_claims: draft.personalization_claims,
        personalization_evidence_ids: personalizationEvidenceIds,
        service_matches: matches.map((m) => m.id),
        compliance,
        risk_flags: draft.risk_flags,
        generated_by: 'personalized-outreach/p0-12',
      },
    }).select('id,prospect_id,opportunity_id,channel,event_type,content,metadata,occurred_at').single()
    if (insertError) throw insertError

    await supabase.from('audit_logs').insert({
      action: 'personalized_outreach_draft',
      resource_type: 'prospect_outreach_events',
      resource_id: event.id,
      metadata: { prospect_id: profile.id, opportunity_id: opportunity.id, channel, human_approval_required: true, send_performed: false },
    })

    return json({ ok: true, draft_event: event, draft, compliance, prospect_id: profile.id, opportunity_id: opportunity.id })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 400)
  }
})
