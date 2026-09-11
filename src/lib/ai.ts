import { supabase } from './supabase'
import type { AiAudit, Lead } from '../types/database'

export async function qualifyLead(lead: Lead) {
  const { data, error } = await supabase.functions.invoke('ai-qualify', { body: { lead } })
  if (error) return { error: error.message }
  if (!data?.ok) return { error: data?.error ?? 'AI qualification failed' }
  return {
    score: Number(data.result?.score ?? 0),
    qualification: data.result?.qualification as 'low' | 'medium' | 'high',
    reasoning: String(data.result?.reasoning ?? ''),
    recommended_action: String(data.result?.recommended_action ?? ''),
    confidence: Number(data.result?.confidence ?? 0),
  }
}

export async function runGrowthAudit(input: {
  company?: Record<string, unknown>
  company_id?: string | null
  lead_id?: string | null
  data?: Record<string, unknown>
}) {
  const { data, error } = await supabase.functions.invoke('ai-audit', { body: input })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error ?? 'AI growth audit failed')
  return { result: data.result, audit_id: data.audit_id } as { result: Omit<AiAudit, 'id' | 'company_id' | 'lead_id' | 'audit_type' | 'source_data' | 'created_at'>; audit_id: string }
}
