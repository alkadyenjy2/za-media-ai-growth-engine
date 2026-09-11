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
    const lead = input.lead ?? input
    if (!lead?.id && !lead?.full_name) throw new Error('A lead object is required')

    const prompt = `You are the lead qualification engine for an AI growth agency.
Return ONLY valid JSON with exactly these keys: score, qualification, reasoning, recommended_action, confidence.
Rules: score is integer 0-100; qualification is low, medium, or high; confidence is 0-1.
Use only supplied facts. Never invent contact details, budget, intent, or company facts.
Lead data:
${JSON.stringify(lead, null, 2)}`

    const result = await callGemini(geminiKey, prompt)
    result.score = clampScore(result.score)
    result.qualification = ['low', 'medium', 'high'].includes(result.qualification) ? result.qualification : 'low'
    result.confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0))

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    let persisted = false
    if (lead.id) {
      const { error } = await supabase.from('leads').update({
        ai_score: result.score,
        ai_qualification: result.qualification,
        ai_reasoning: result.reasoning ?? null,
        ai_recommended_action: result.recommended_action ?? null,
        ai_confidence: result.confidence,
        ai_evaluated_at: new Date().toISOString(),
      }).eq('id', lead.id)
      if (error) throw error
      persisted = true
    }

    await supabase.from('audit_logs').insert({
      action: 'ai_qualification',
      entity_type: 'lead',
      entity_id: lead.id ?? null,
      actor: 'AI Core',
      details: { ...result, persisted },
    })

    return new Response(JSON.stringify({ ok: true, result, persisted }), { headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: jsonHeaders })
  }
})
