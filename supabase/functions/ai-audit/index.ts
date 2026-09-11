import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']

function extractJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('Gemini returned non-JSON output')
  return JSON.parse(cleaned.slice(start, end + 1))
}

function clampScore(value: unknown) {
  const score = Number(value)
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0
}

async function callGemini(key: string, prompt: string) {
  let lastError = 'Gemini request failed'
  for (const model of GEMINI_MODELS) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    })
    if (response.ok) {
      const gemini = await response.json()
      const text = gemini?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Gemini returned no candidate text')
      return extractJson(text)
    }
    const body = await response.text()
    lastError = `Gemini ${model} failed (${response.status}): ${body.slice(0, 500)}`
    if (![404, 400].includes(response.status)) break
  }
  throw new Error(lastError)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders })

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')

    const input = await req.json()
    const company = input.company ?? {}
    const data = input.data ?? input

    const prompt = `You are a growth strategist performing a factual business growth audit.
Return ONLY valid JSON with exactly these keys: overall_score, strengths, weaknesses, opportunities, recommended_actions, priority.
overall_score is integer 0-100. strengths, weaknesses, opportunities, and recommended_actions are arrays of concise strings. priority must be low, medium, or high.
Use only supplied facts. Do not invent metrics, customers, budgets, channels, or performance.
Company:
${JSON.stringify(company, null, 2)}
Operational data:
${JSON.stringify(data, null, 2)}`

    const result = await callGemini(geminiKey, prompt)
    result.overall_score = clampScore(result.overall_score)
    result.strengths = Array.isArray(result.strengths) ? result.strengths.slice(0, 10) : []
    result.weaknesses = Array.isArray(result.weaknesses) ? result.weaknesses.slice(0, 10) : []
    result.opportunities = Array.isArray(result.opportunities) ? result.opportunities.slice(0, 10) : []
    result.recommended_actions = Array.isArray(result.recommended_actions) ? result.recommended_actions.slice(0, 10) : []
    result.priority = ['low', 'medium', 'high'].includes(result.priority) ? result.priority : 'medium'

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: audit, error } = await supabase.from('ai_audits').insert({
      company_id: input.company_id ?? company.id ?? null,
      lead_id: input.lead_id ?? null,
      audit_type: 'growth',
      overall_score: result.overall_score,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      opportunities: result.opportunities,
      recommended_actions: result.recommended_actions,
      priority: result.priority,
      source_data: { company, data },
    }).select().single()
    if (error) throw error

    await supabase.from('audit_logs').insert({
      action: 'ai_growth_audit',
      entity_type: 'ai_audit',
      entity_id: audit.id,
      actor: 'AI Core',
      details: { overall_score: result.overall_score, priority: result.priority },
    })

    return new Response(JSON.stringify({ ok: true, result, audit_id: audit.id }), { headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: jsonHeaders })
  }
})
