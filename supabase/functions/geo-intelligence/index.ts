import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders })

type Evidence = { id: string; evidence_key?: string; evidence_type: string; source_url: string | null; claim: string; evidence_data: Record<string, unknown>; confidence: number | null; observed_at: string; evidence_status?: string }

type Finding = { key: string; status: 'pass' | 'warn' | 'fail' | 'unknown'; points: number; max_points: number; evidence_id?: string; claim: string; interpretation: string; measurement: 'DETERMINISTIC' | 'ESTIMATE' | 'MEASURED' }

const score = (findings: Finding[]) => Math.round(findings.reduce((sum, f) => sum + f.points, 0) / Math.max(1, findings.reduce((sum, f) => sum + f.max_points, 0)) * 100)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')
    const input = await req.json()
    if (!input.prospect_id) throw new Error('prospect_id is required')

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: profile, error: profileError } = await supabase.from('prospect_profiles').select('id,canonical_name,website_url,domain').eq('id', input.prospect_id).single()
    if (profileError) throw profileError
    if (!profile.website_url) throw new Error('Prospect has no website_url')

    const { data: evidence, error: evidenceError } = await supabase.from('prospect_evidence').select('id,evidence_key,evidence_type,source_url,claim,evidence_data,confidence,observed_at,evidence_status').eq('prospect_id', profile.id).in('evidence_type', ['website','seo','geo','social']).order('observed_at', { ascending: false }).limit(250)
    if (evidenceError) throw evidenceError
    const rows = (evidence ?? []) as Evidence[]
    if (!rows.length) return json({ ok: false, measured: false, reason: 'No website intelligence evidence exists. Run website-intelligence first.', prospect_id: profile.id }, 409)

    const latest = (key: string) => rows.find((r) => r.evidence_key === key && r.evidence_status !== 'invalid')
    const findings: Finding[] = []
    const ids: string[] = []

    const add = (f: Finding) => { findings.push(f); if (f.evidence_id) ids.push(f.evidence_id) }
    const homeStatus = latest('website.home.status')
    add({ key: 'crawlable_homepage', status: homeStatus?.evidence_data?.status === 200 ? 'pass' : homeStatus ? 'fail' : 'unknown', points: homeStatus?.evidence_data?.status === 200 ? 20 : 0, max_points: 20, evidence_id: homeStatus?.id, claim: homeStatus?.claim ?? 'No homepage HTTP evidence found.', interpretation: 'AI search systems need accessible, retrievable pages before citation can occur.', measurement: 'DETERMINISTIC' })

    const structured = latest('website.structured_data')
    const schemaCount = Number(structured?.evidence_data?.json_ld_blocks ?? 0)
    add({ key: 'structured_data', status: schemaCount > 0 ? 'pass' : structured ? 'warn' : 'unknown', points: schemaCount > 0 ? 15 : 0, max_points: 15, evidence_id: structured?.id, claim: structured?.claim ?? 'No structured-data evidence found.', interpretation: 'Structured data can strengthen machine-readable entity and content context, but it is not a special AI-search requirement.', measurement: 'DETERMINISTIC' })

    const headings = latest('website.headings')
    const h1 = Array.isArray(headings?.evidence_data?.h1) ? headings?.evidence_data?.h1 as unknown[] : []
    add({ key: 'content_structure', status: h1.length === 1 ? 'pass' : h1.length > 0 ? 'warn' : 'fail', points: h1.length === 1 ? 15 : h1.length > 0 ? 9 : 0, max_points: 15, evidence_id: headings?.id, claim: headings?.claim ?? 'No heading evidence found.', interpretation: 'Clear page structure improves human and machine parsing; this is an accessibility/content-quality signal, not a magic GEO hack.', measurement: 'DETERMINISTIC' })

    const title = latest('website.meta.title')
    const description = latest('website.meta.description')
    const titleOk = Boolean(title?.evidence_data?.title)
    const descOk = Boolean(description?.evidence_data?.description)
    add({ key: 'page_metadata', status: titleOk && descOk ? 'pass' : titleOk || descOk ? 'warn' : 'fail', points: titleOk && descOk ? 10 : titleOk || descOk ? 6 : 0, max_points: 10, evidence_id: description?.id ?? title?.id, claim: titleOk && descOk ? 'Homepage has title and description metadata.' : 'One or more core metadata fields are missing.', interpretation: 'Metadata supports discovery and presentation in conventional search; Google states the same foundational SEO practices apply to AI features.', measurement: 'DETERMINISTIC' })

    const canonical = latest('website.canonical')
    add({ key: 'canonical', status: canonical?.evidence_data?.canonical ? 'pass' : canonical ? 'warn' : 'unknown', points: canonical?.evidence_data?.canonical ? 10 : 0, max_points: 10, evidence_id: canonical?.id, claim: canonical?.claim ?? 'No canonical evidence found.', interpretation: 'Canonicalization reduces ambiguity about the preferred URL.', measurement: 'DETERMINISTIC' })

    const social = latest('website.social.links')
    const socialCount = Array.isArray(social?.evidence_data?.links) ? social.evidence_data.links.length : 0
    add({ key: 'brand_surfaces', status: socialCount > 0 ? 'pass' : social ? 'warn' : 'unknown', points: socialCount > 0 ? 10 : 0, max_points: 10, evidence_id: social?.id, claim: social?.claim ?? 'No social-link evidence found.', interpretation: 'Owned and off-site brand surfaces can contribute to entity corroboration, but this does not prove AI citation visibility.', measurement: 'ESTIMATE' })

    const conversion = latest('website.conversion.forms')
    const formCount = Number(conversion?.evidence_data?.forms ?? 0)
    add({ key: 'actionability', status: formCount > 0 ? 'pass' : conversion ? 'warn' : 'unknown', points: formCount > 0 ? 10 : 0, max_points: 10, evidence_id: conversion?.id, claim: conversion?.claim ?? 'No conversion-path evidence found.', interpretation: 'AI visibility has business value only when the destination page gives visitors a clear next action.', measurement: 'DETERMINISTIC' })

    const recs: string[] = []
    for (const f of findings) if (f.status === 'fail' || f.status === 'warn') recs.push(`${f.key}: ${f.interpretation}`)
    if (!recs.some((x) => x.startsWith('structured_data'))) recs.push('Keep structured data aligned with visible content; do not add AI-only markup.')
    recs.push('Do not treat llms.txt as a required Google AI-search optimization: Google explicitly says there are no special AI files or schema requirements for AI Overviews/AI Mode.')
    recs.push('AI-engine visibility is NOT measured by this assessment. Query-based citation/mention metrics require real engine observations and repeated runs.')

    const overall = score(findings)
    const confidence = Math.min(100, Math.round(findings.filter((f) => f.measurement === 'DETERMINISTIC').length / Math.max(1, findings.length) * 100))
    const { data: assessment, error: insertError } = await supabase.from('prospect_geo_assessments').insert({ prospect_id: profile.id, overall_score: overall, confidence, measurement_status: 'deterministic', findings, recommendations: recs, source_evidence_ids: [...new Set(ids)], measured_metrics: {} }).select('id,overall_score,confidence,measurement_status,created_at').single()
    if (insertError) throw insertError

    await supabase.from('prospect_evidence').insert({ prospect_id: profile.id, evidence_type: 'geo', source_type: 'derived', source_name: 'geo-intelligence', source_url: profile.website_url, claim: `Deterministic GEO readiness assessment scored ${overall}/100. This is not a measured AI-engine visibility score.`, evidence_data: { assessment_id: assessment.id, overall_score: overall, confidence, measurement_status: 'deterministic', findings_count: findings.length }, confidence: confidence / 100, evidence_key: `geo.assessment.${assessment.id}`, evidence_status: 'active', extractor: 'geo-intelligence/p0-11', observed_at: new Date().toISOString() })

    return json({ ok: true, prospect_id: profile.id, assessment, findings, recommendations: recs, measured: false, measurement_status: 'deterministic' })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 400)
  }
})
