import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const normalize = (value: unknown) => String(value ?? '').toLowerCase().trim()
const tokens = (value: unknown) => new Set(normalize(value).split(/[^a-z0-9&]+/).filter((t) => t.length >= 4))

function overlapScore(a: string, b: string) {
  const left = tokens(a)
  const right = tokens(b)
  if (!left.size || !right.size) return 0
  let hits = 0
  for (const token of left) if (right.has(token)) hits++
  return Math.min(100, Math.round((hits / Math.max(1, Math.min(left.size, right.size))) * 100))
}

function expectedOutcome(category: string) {
  const c = normalize(category)
  if (c === 'paid advertising') return 'Improve paid acquisition efficiency by aligning targeting, creative, offer, and conversion path with the observed opportunity.'
  if (c === 'content & social') return 'Improve content-to-demand performance through stronger content, social execution, audience alignment, and calls to action.'
  if (c === 'growth strategy') return 'Turn the observed signal into a focused growth plan with a clear priority, experiment, and measurable next action.'
  if (c === 'branding') return 'Strengthen positioning, differentiation, and customer trust around the identified business opportunity.'
  if (c === 'promotion') return 'Convert the identified opportunity into a targeted promotional campaign with a clear audience and business objective.'
  if (c === 'ai automation') return 'Reduce manual growth-operations friction and improve lead intelligence, qualification, follow-up, or reporting through AI-enabled workflows.'
  return 'Apply the most relevant ZA Media capability to address the evidence-backed opportunity.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) throw new Error('Supabase server configuration is missing')

    const input = await req.json()
    const prospectId = String(input.prospect_id ?? '').trim()
    const opportunityId = String(input.opportunity_id ?? '').trim()
    if (!prospectId) throw new Error('prospect_id is required')

    const supabase = createClient(url, serviceKey)

    let opportunityQuery = supabase
      .from('prospect_opportunities')
      .select('id,prospect_id,opportunity_type,problem,business_impact,opportunity_score,status,opportunity_data')
      .eq('prospect_id', prospectId)
      .not('status', 'in', '(rejected,lost,expired)')
      .order('opportunity_score', { ascending: false })
      .limit(25)

    if (opportunityId) opportunityQuery = opportunityQuery.eq('id', opportunityId)

    const { data: opportunities, error: opportunityError } = await opportunityQuery
    if (opportunityError) throw opportunityError
    if (!opportunities?.length) {
      return json({ ok: true, prospect_id: prospectId, matched: 0, matches: [], note: 'No eligible opportunities found.' })
    }

    const { data: profile, error: profileError } = await supabase
      .from('prospect_profiles')
      .select('id,canonical_name,fit_score,confidence_score')
      .eq('id', prospectId)
      .single()
    if (profileError) throw profileError

    const { data: services, error: serviceError } = await supabase
      .from('products')
      .select('id,name,category,description,features,is_active')
      .eq('is_active', true)
    if (serviceError) throw serviceError
    if (!services?.length) {
      return json({ ok: true, prospect_id: prospectId, matched: 0, matches: [], note: 'Service catalog is empty; no service match fabricated.' })
    }

    const matches: any[] = []

    for (const opportunity of opportunities) {
      const candidateFamilies = Array.isArray(opportunity.opportunity_data?.candidate_service_families)
        ? opportunity.opportunity_data.candidate_service_families.map(normalize)
        : []
      const context = `${opportunity.opportunity_type} ${opportunity.problem} ${opportunity.business_impact}`
      const opportunityScore = clamp(Number(opportunity.opportunity_score ?? 0))
      const prospectFit = profile.fit_score == null ? 50 : clamp(Number(profile.fit_score))
      const confidence = profile.confidence_score == null ? 50 : clamp(Number(profile.confidence_score))

      const ranked = services.map((service) => {
        const familyIndex = candidateFamilies.findIndex((family) => family === normalize(service.category))
        const familyScore = familyIndex === -1 ? 0 : Math.max(60, 100 - familyIndex * 12)
        const semanticScore = overlapScore(context, `${service.name} ${service.category} ${service.description} ${(service.features ?? []).join(' ')}`)
        const score = clamp(
          familyScore * 0.55 +
          semanticScore * 0.15 +
          opportunityScore * 0.15 +
          prospectFit * 0.10 +
          confidence * 0.05,
        )
        return { service, familyScore, semanticScore, score, familyIndex }
      })
        .filter((row) => row.familyScore > 0 || row.semanticScore >= 25)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)

      for (const row of ranked) {
        const { service, score, familyScore, semanticScore, familyIndex } = row
        const rationale = familyScore > 0
          ? `${service.name} matches the opportunity's recommended service family (${service.category}) and is supported by the observed opportunity context. The match is a recommendation, not proof of buyer intent.`
          : `${service.name} has contextual overlap with the opportunity based on its catalog description/features. No direct service-family match was present, so confidence is lower.`

        const { data: existing } = await supabase
          .from('prospect_service_matches')
          .select('id')
          .eq('prospect_id', prospectId)
          .eq('opportunity_id', opportunity.id)
          .eq('service_name', service.name)
          .limit(1)

        const payload = {
          prospect_id: prospectId,
          opportunity_id: opportunity.id,
          service_name: service.name,
          offer_name: service.name,
          rationale,
          expected_outcome: expectedOutcome(service.category),
          fit_score: score,
          match_data: {
            engine: 'service-matching-v1',
            product_id: service.id,
            service_category: service.category,
            candidate_service_family: candidateFamilies[familyIndex] ?? null,
            family_match_score: familyScore,
            semantic_context_score: semanticScore,
            opportunity_score: opportunityScore,
            prospect_fit_score: prospectFit,
            confidence_score: confidence,
            opportunity_type: opportunity.opportunity_type,
            evidence_id: opportunity.evidence_id ?? opportunity.opportunity_data?.evidence_id ?? null,
            evidence_claim: opportunity.opportunity_data?.evidence_claim ?? null,
            evidence_source: opportunity.opportunity_data?.evidence_source ?? null,
            human_approval_required: true,
            synthetic_data_created: false,
          },
        }

        if (existing?.[0]?.id) {
          const { data: updated, error } = await supabase
            .from('prospect_service_matches')
            .update(payload)
            .eq('id', existing[0].id)
            .select('id,prospect_id,opportunity_id,service_name,offer_name,rationale,expected_outcome,fit_score,match_data')
            .single()
          if (error) throw error
          matches.push({ ...updated, action: 'updated' })
        } else {
          const { data: inserted, error } = await supabase
            .from('prospect_service_matches')
            .insert(payload)
            .select('id,prospect_id,opportunity_id,service_name,offer_name,rationale,expected_outcome,fit_score,match_data')
            .single()
          if (error) throw error
          matches.push({ ...inserted, action: 'created' })
        }
      }
    }

    await supabase.from('audit_logs').insert({
      action: 'service_matching_run',
      entity_type: 'prospect_profile',
      entity_id: prospectId,
      actor: 'AI Core',
      details: {
        engine: 'service-matching-v1',
        opportunities_considered: opportunities.length,
        matches_created_or_updated: matches.length,
        service_catalog_count: services.length,
        synthetic_data_created: false,
        human_approval_required: true,
      },
    })

    return json({
      ok: true,
      prospect_id: prospectId,
      matched: matches.length,
      matches,
      note: 'Service matches are evidence-backed recommendations. No outreach or external action is performed.',
    })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
