import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireProspectWorkspaceAccess } from '../_shared/workspace-auth.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders })
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

function ageDays(value: string | null | undefined) { if (!value) return 999; return Math.max(0, (Date.now() - new Date(value).getTime()) / 86400000) }
function decayFactor(signal: any) { const age = ageDays(signal.detected_at); const expiresAt = signal.expires_at ? new Date(signal.expires_at).getTime() : 0; if (expiresAt && expiresAt <= Date.now()) return 0; if (age <= 1) return 1; if (age <= 7) return 0.92; if (age <= 14) return 0.82; if (age <= 30) return 0.68; if (age <= 60) return 0.5; return 0.3 }
function sourceFactor(sourceType: string) { if (sourceType === 'first_party') return 1; if (sourceType === 'internal') return 0.95; if (sourceType === 'public') return 0.85; if (sourceType === 'derived') return 0.65; return 0.7 }
function signalContribution(signal: any) { const confidence = Math.max(0, Math.min(1, Number(signal.signal_data?.confidence ?? 0.6))); const freshness = decayFactor(signal); const source = sourceFactor(String(signal.signal_data?.source_type ?? 'public')); const strength = Math.max(0, Math.min(100, Number(signal.strength ?? 0))); return strength * confidence * freshness * source }
function aggregateIntent(signals: any[]) {
  const byRoot = new Map<string, any>()
  for (const signal of signals) { const root = String(signal.signal_data?.root_event_key ?? signal.id); const contribution = signalContribution(signal); if (!byRoot.has(root) || contribution > byRoot.get(root).contribution) byRoot.set(root, { signal, contribution }) }
  const roots = [...byRoot.values()]
  const uniqueTypes = new Set(roots.map(({ signal }) => signal.signal_type)).size
  const sourceTypes = new Set(roots.map(({ signal }) => String(signal.signal_data?.source_type ?? 'public'))).size
  const ordered = roots.map((x) => x.contribution).sort((a, b) => b - a)
  let total = 0; ordered.forEach((value, index) => { total += value * Math.pow(0.62, index) })
  const diversityBonus = Math.min(15, Math.max(0, (uniqueTypes - 1) * 3 + (sourceTypes - 1) * 2))
  const intent = clamp(total * 0.85 + diversityBonus)
  const averageConfidence = roots.length ? clamp(roots.reduce((sum, { signal }) => sum + Number(signal.signal_data?.confidence ?? 0.6) * 100, 0) / roots.length) : 0
  const freshness = roots.length ? clamp(roots.reduce((sum, { signal }) => sum + decayFactor(signal) * 100, 0) / roots.length) : 0
  return { intent, root_events: roots.length, signal_types: uniqueTypes, source_types: sourceTypes, confidence: averageConfidence, freshness, strongest_signals: roots.sort((a, b) => b.contribution - a.contribution).slice(0, 5).map(({ signal, contribution }) => ({ id: signal.id, type: signal.signal_type, strength: signal.strength, contribution: Math.round(contribution), root_event_key: signal.signal_data?.root_event_key ?? null })) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL'); const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')
    const input = await req.json(); const prospectId = String(input.prospect_id ?? '').trim(); if (!prospectId) throw new Error('prospect_id is required')
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { workspaceId } = await requireProspectWorkspaceAccess(req, supabase, prospectId)
    const { data: profile, error: profileError } = await supabase.from('prospect_profiles').select('id,canonical_name,fit_score,opportunity_score,confidence_score,profile_data').eq('id', prospectId).eq('workspace_id', workspaceId).single(); if (profileError) throw profileError
    const { data: signals, error: signalsError } = await supabase.from('prospect_intent_signals').select('id,signal_type,strength,evidence_id,signal_data,detected_at,expires_at').eq('prospect_id', prospectId).eq('workspace_id', workspaceId).order('detected_at', { ascending: false }).limit(500); if (signalsError) throw signalsError
    const activeSignals = (signals ?? []).filter((signal) => !signal.expires_at || new Date(signal.expires_at).getTime() > Date.now())
    const intent = aggregateIntent(activeSignals); const fit = profile.fit_score == null ? null : clamp(Number(profile.fit_score)); const opportunity = profile.opportunity_score == null ? 0 : clamp(Number(profile.opportunity_score))
    const confidence = intent.root_events ? intent.confidence : (profile.confidence_score == null ? 0 : clamp(Number(profile.confidence_score)))
    const priority = fit == null ? clamp(intent.intent * 0.55 + confidence * 0.25 + opportunity * 0.2) : clamp(fit * 0.45 + intent.intent * 0.35 + confidence * 0.1 + opportunity * 0.1)
    const now = new Date().toISOString(); const nextReviewHours = intent.intent >= 75 ? 24 : intent.intent >= 50 ? 72 : 168; const nextReview = new Date(Date.now() + nextReviewHours * 3600000).toISOString()
    const profileData = { ...(profile.profile_data ?? {}), scoring: { version: 'multi-signal-v1', scored_at: now, intent, priority_basis: fit == null ? 'intent+confidence+opportunity' : 'fit+intent+confidence+opportunity', hard_claims: { intent_is_purchase_probability: false, priority_is_purchase_probability: false } } }
    const { data: updated, error: updateError } = await supabase.from('prospect_profiles').update({ intent_score: intent.intent, priority_score: priority, confidence_score: confidence, last_scored_at: now, last_observed_at: activeSignals.length ? activeSignals.reduce((latest, signal) => signal.detected_at > latest ? signal.detected_at : latest, activeSignals[0].detected_at) : profileData.scoring.scored_at, next_review_at: nextReview, profile_data: profileData, updated_at: now }).eq('id', prospectId).eq('workspace_id', workspaceId).select('id,canonical_name,fit_score,intent_score,opportunity_score,priority_score,confidence_score,last_scored_at,last_observed_at,next_review_at').single(); if (updateError) throw updateError
    await supabase.from('audit_logs').insert({ action: 'multi_signal_score', entity_type: 'prospect_profile', entity_id: prospectId, actor: 'AI Core', details: { workspace_id: workspaceId, engine: 'multi-signal-v1', active_signals: activeSignals.length, root_events: intent.root_events, signal_types: intent.signal_types, source_types: intent.source_types, intent_score: intent.intent, priority_score: priority, confidence_score: confidence, next_review_at: nextReview } })
    return json({ ok: true, prospect_id: prospectId, scores: updated, scoring: intent, note: 'Scores are routing intelligence, not purchase-probability claims. No synthetic signals or prospects are created.' })
  } catch (error) { if (error instanceof Response) return error; return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500) }
})
