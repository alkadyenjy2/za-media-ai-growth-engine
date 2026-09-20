import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireProspectWorkspaceAccess } from '../_shared/workspace-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const clamp = (n: number) => Math.max(0, Math.min(100, Number(n)))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) throw new Error('Supabase server configuration is missing')

    const input = await req.json()
    const prospectId = String(input.prospect_id ?? '').trim()
    if (!prospectId) return json({ ok: false, error: 'prospect_id is required' }, 400)

    const supabase = createClient(url, serviceKey)
    const { workspaceId } = await requireProspectWorkspaceAccess(req, supabase, prospectId)

    const { data: policy, error: policyError } = await supabase
      .from('priority_routing_policies')
      .select('version,thresholds')
      .eq('is_active', true)
      .single()
    if (policyError) throw policyError

    const { data: profile, error: profileError } = await supabase
      .from('prospect_profiles')
      .select('id,canonical_name,fit_score,intent_score,opportunity_score,priority_score,confidence_score')
      .eq('id', prospectId)
      .eq('workspace_id', workspaceId)
      .single()
    if (profileError) throw profileError

    const [{ data: evidence, error: evidenceError }, { data: signals, error: signalsError }, { data: opportunities, error: opportunitiesError }, { data: matches, error: matchesError }] =
      await Promise.all([
        supabase.from('prospect_evidence').select('id,evidence_status,observed_at,expires_at,content_hash,source_type,source_name,source_url,claim').eq('prospect_id', prospectId).eq('workspace_id', workspaceId).order('observed_at', { ascending: false }),
        supabase.from('prospect_intent_signals').select('id,signal_type,strength,evidence_id,signal_data,detected_at,expires_at').eq('prospect_id', prospectId).eq('workspace_id', workspaceId).order('detected_at', { ascending: false }),
        supabase.from('prospect_opportunities').select('id,status,opportunity_score,updated_at').eq('prospect_id', prospectId).eq('workspace_id', workspaceId),
        supabase.from('prospect_service_matches').select('id,service_name,offer_name,fit_score,created_at,match_data').eq('prospect_id', prospectId).eq('workspace_id', workspaceId),
      ])
    if (evidenceError) throw evidenceError
    if (signalsError) throw signalsError
    if (opportunitiesError) throw opportunitiesError
    if (matchesError) throw matchesError

    const now = Date.now()
    const activeEvidence = (evidence ?? []).filter((row) =>
      row.evidence_status === 'active' && (!row.expires_at || new Date(row.expires_at).getTime() > now)
    )
    const expiredEvidence = (evidence ?? []).filter((row) =>
      row.expires_at && new Date(row.expires_at).getTime() <= now
    )
    const activeSignals = (signals ?? []).filter((row) =>
      !row.expires_at || new Date(row.expires_at).getTime() > now
    )
    const activeOpportunities = (opportunities ?? []).filter((row) =>
      ['identified', 'reviewed', 'approved', 'active'].includes(row.status)
    )
    const activeServiceMatch = (matches ?? []).length > 0

    const hashes = activeEvidence.map((row) => row.content_hash).filter(Boolean)
    const duplicateHashes = hashes.filter((hash, index) => hashes.indexOf(hash) !== index)
    let workspaceDuplicateHashes: string[] = []
    if (hashes.length) {
      const { data: duplicates, error: duplicateError } = await supabase
        .from('prospect_evidence')
        .select('id,content_hash')
        .eq('workspace_id', workspaceId)
        .in('content_hash', [...new Set(hashes)])
      if (duplicateError) throw duplicateError
      const activeEvidenceIds = new Set(activeEvidence.map((row) => row.id))
      workspaceDuplicateHashes = [...new Set((duplicates ?? [])
        .filter((row) => !activeEvidenceIds.has(row.id))
        .map((row) => row.content_hash)
        .filter(Boolean))]
    }

    const t = policy.thresholds ?? {}
    const p1 = t.P1 ?? {}
    const p2 = t.P2 ?? {}
    const p3 = t.P3 ?? {}
    const research = t.RESEARCH_REQUIRED ?? {}

    const intent = profile.intent_score == null ? null : clamp(Number(profile.intent_score))
    const priority = profile.priority_score == null ? null : clamp(Number(profile.priority_score))
    const confidence = profile.confidence_score == null ? null : clamp(Number(profile.confidence_score))
    const evidenceCount = activeEvidence.length
    const signalCount = activeSignals.length
    const opportunityActive = activeOpportunities.length > 0

    const snapshot = activeEvidence.map((row) => ({
      evidence_id: row.id,
      content_hash: row.content_hash ?? null,
      expires_at: row.expires_at ?? null,
      observed_at: row.observed_at,
      evidence_status: row.evidence_status,
      source_type: row.source_type,
      source_name: row.source_name,
      source_url: row.source_url,
      claim: row.claim,
    }))

    const researchReasons: string[] = []
    if (research.active_evidence_required && evidenceCount === 0) researchReasons.push('no_active_evidence')
    if (research.expired_evidence_requires_research && expiredEvidence.length > 0 && evidenceCount === 0) researchReasons.push('expired_evidence_only')
    if (research.duplicate_content_hash_requires_research && (duplicateHashes.length > 0 || workspaceDuplicateHashes.length > 0)) researchReasons.push('duplicate_content_hash')

    let tier = 'RESEARCH_REQUIRED'
    const reasons: string[] = []

    if (!researchReasons.length &&
      intent != null &&
      priority != null &&
      confidence != null &&
      intent >= Number(p1.intent_min ?? 80) &&
      priority >= Number(p1.priority_min ?? 75) &&
      confidence >= Number(p1.confidence_min ?? 70) &&
      evidenceCount >= Number(p1.evidence_min ?? 2) &&
      (!p1.freshness_days || activeEvidence.every((row) => (now - new Date(row.observed_at).getTime()) / 86400000 <= Number(p1.freshness_days))) &&
      (!p1.active_opportunity_required || opportunityActive) &&
      (!p1.active_service_match_required || activeServiceMatch)
    ) {
      tier = 'P1'
      reasons.push('meets_p1_policy')
    } else if (!researchReasons.length &&
      intent != null &&
      intent >= Number(p2.intent_min ?? 50) &&
      intent <= Number(p2.intent_max ?? 79) &&
      evidenceCount >= Number(p2.evidence_min ?? 1) &&
      (!p2.active_opportunity_required || opportunityActive)
    ) {
      tier = 'P2'
      reasons.push('meets_p2_policy')
    } else if (!researchReasons.length &&
      intent != null &&
      intent <= Number(p3.intent_max ?? 49) &&
      (!p3.evidence_required || evidenceCount >= 1) &&
      (!p3.intent_signals_required || signalCount >= 1) &&
      (!p3.active_opportunity_required || opportunityActive)
    ) {
      tier = 'P3'
      reasons.push('meets_p3_policy')
    } else {
      if (intent == null) reasons.push('missing_intent_score')
      if (priority == null) reasons.push('missing_priority_score')
      if (confidence == null) reasons.push('missing_confidence_score')
      if (evidenceCount < 1) reasons.push('insufficient_active_evidence')
      if (tier === 'RESEARCH_REQUIRED' && signalCount === 0 && intent != null && intent <= Number(p3.intent_max ?? 49)) reasons.push('p3_requires_active_intent_signal')
      reasons.push(...researchReasons)
    }

    const decision = {
      prospect_id: prospectId,
      workspace_id: workspaceId,
      policy_version: policy.version,
      priority_tier: tier,
      intent_score: intent,
      priority_score: priority,
      confidence_score: confidence,
      reasoning: JSON.stringify({
        engine: 'priority-mapping-v1',
        reasons: [...new Set(reasons)],
        evidence_count: evidenceCount,
        active_signal_count: signalCount,
        active_opportunity: opportunityActive,
        active_service_match: activeServiceMatch,
        duplicate_content_hashes: [...new Set([...duplicateHashes, ...workspaceDuplicateHashes])],
      }),
      evidence_ids: activeEvidence.map((row) => row.id),
      evidence_snapshot: snapshot,
      active_opportunity: opportunityActive,
      active_service_match: activeServiceMatch,
      updated_at: new Date().toISOString(),
    }

    const { data: saved, error: saveError } = await supabase
      .from('prospect_priority_decisions')
      .upsert(decision, { onConflict: 'prospect_id,policy_version' })
      .select('*')
      .single()
    if (saveError) throw saveError

    const { error: auditError } = await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      action: 'priority_mapping_run',
      entity_type: 'prospect_priority_decision',
      entity_id: saved.id,
      actor: 'AI Core',
      details: {
        engine: 'priority-mapping-v1',
        policy_version: policy.version,
        prospect_id: prospectId,
        priority_tier: tier,
        evidence_count: evidenceCount,
        active_signal_count: signalCount,
        active_opportunity: opportunityActive,
        active_service_match: activeServiceMatch,
        evidence_ids: activeEvidence.map((row) => row.id),
        evidence_snapshot: snapshot,
        reasons: [...new Set(reasons)],
        synthetic_data_created: false,
        external_action_performed: false,
      },
    })
    if (auditError) throw auditError

    return json({
      ok: true,
      prospect_id: prospectId,
      policy_version: policy.version,
      decision: saved,
      proof: {
        evidence_count: evidenceCount,
        active_signal_count: signalCount,
        active_opportunity: opportunityActive,
        active_service_match: activeServiceMatch,
        audit_action: 'priority_mapping_run',
        external_action_performed: false,
      },
    })
  } catch (error) {
    if (error instanceof Response) return error
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
