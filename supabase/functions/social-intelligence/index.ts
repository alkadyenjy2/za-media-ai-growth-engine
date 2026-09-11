import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'x' | 'other'

function responseJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders })
}

function detectPlatform(raw: string): Platform {
  const host = new URL(raw).hostname.toLowerCase()
  if (host.includes('facebook.com')) return 'facebook'
  if (host.includes('instagram.com')) return 'instagram'
  if (host.includes('linkedin.com')) return 'linkedin'
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube'
  if (host.includes('tiktok.com')) return 'tiktok'
  if (host === 'x.com' || host.includes('twitter.com')) return 'x'
  return 'other'
}

function normalizeSocialUrl(raw: string) {
  const value = raw.trim()
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported social URL protocol')
  url.hash = ''
  url.search = ''
  return url.href.replace(/\/$/, '')
}

function scorePresence(platforms: Platform[]) {
  const unique = new Set(platforms)
  const core = ['facebook', 'instagram', 'linkedin'] as Platform[]
  const present = core.filter((platform) => unique.has(platform)).length
  return Math.round((present / core.length) * 100)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return responseJson({ ok: false, error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')

    const input = await req.json()
    if (!input.prospect_id) throw new Error('prospect_id is required')
    if (!Array.isArray(input.profiles)) throw new Error('profiles must be an array')

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: profile, error: profileError } = await supabase.from('prospect_profiles').select('*').eq('id', input.prospect_id).single()
    if (profileError) throw profileError

    const now = new Date().toISOString()
    const normalized = input.profiles.slice(0, 20).map((entry: any) => {
      const url = normalizeSocialUrl(String(entry.url ?? ''))
      const platform = (entry.platform ?? detectPlatform(url)) as Platform
      const metrics = entry.metrics && typeof entry.metrics === 'object' ? entry.metrics : null
      return { platform, url, handle: entry.handle ?? null, connected: Boolean(entry.connected), metrics }
    })

    const deduped = Array.from(new Map(normalized.map((entry: any) => [`${entry.platform}:${entry.url}`, entry])).values())
    const platforms = deduped.map((entry: any) => entry.platform as Platform)
    const corePlatforms = new Set(['facebook', 'instagram', 'linkedin'])
    const missingCore = [...corePlatforms].filter((platform) => !platforms.includes(platform as Platform))
    const connectedCount = deduped.filter((entry: any) => entry.connected).length
    const metricsCount = deduped.filter((entry: any) => entry.metrics).length

    const evidenceRows = deduped.map((entry: any) => ({
      prospect_id: profile.id,
      evidence_type: 'social',
      source_type: entry.connected ? 'first_party' : 'public',
      source_name: `${entry.platform} profile`,
      source_url: entry.url,
      claim: entry.connected
        ? `${entry.platform} is connected as a first-party social profile.`
        : `${entry.platform} profile URL is present in the prospect social footprint.`,
      evidence_data: { platform: entry.platform, handle: entry.handle, connected: entry.connected, metrics: entry.metrics },
      confidence: entry.connected ? 1 : 0.95,
      evidence_key: `social.${entry.platform}.presence`,
      evidence_status: 'active',
      extractor: 'social-intelligence',
      severity: 'info',
      observed_at: now,
    }))

    evidenceRows.push({
      prospect_id: profile.id,
      evidence_type: 'social',
      source_type: 'derived',
      source_name: 'social-intelligence',
      source_url: profile.website_url,
      claim: missingCore.length ? `Missing core social coverage: ${missingCore.join(', ')}.` : 'Core social coverage is present across Facebook, Instagram and LinkedIn.',
      evidence_data: { platforms, missing_core: missingCore, presence_score: scorePresence(platforms), connected_count: connectedCount, metrics_count: metricsCount },
      confidence: 1,
      evidence_key: 'social.coverage.score',
      evidence_status: 'active',
      extractor: 'social-intelligence',
      severity: missingCore.length ? 'low' : 'info',
      impact: missingCore.length ? 'Gaps in core social presence can reduce trust and discovery coverage.' : null,
      observed_at: now,
    })

    await supabase.from('prospect_evidence').insert(evidenceRows)

    const current = (profile.profile_data ?? {}) as Record<string, unknown>
    const socialIntelligence = {
      observed_at: now,
      profiles: deduped,
      presence_score: scorePresence(platforms),
      missing_core_platforms: missingCore,
      connected_profiles: connectedCount,
      profiles_with_metrics: metricsCount,
      policy: 'Public profile URLs and explicitly supplied first-party metrics only; no private-account scraping.',
    }
    await supabase.from('prospect_profiles').update({
      profile_data: { ...current, social_intelligence: socialIntelligence },
      last_observed_at: now,
      updated_at: now,
    }).eq('id', profile.id)

    await supabase.from('audit_logs').insert({
      action: 'social_intelligence',
      entity_type: 'prospect_profile',
      entity_id: profile.id,
      actor: 'AI Core',
      details: { profile_count: deduped.length, connected_count: connectedCount, presence_score: scorePresence(platforms) },
    })

    return responseJson({ ok: true, prospect_id: profile.id, profiles: deduped, presence_score: scorePresence(platforms), missing_core_platforms: missingCore })
  } catch (error) {
    return responseJson({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
