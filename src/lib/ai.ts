import { supabase } from './supabase'
import type { AiAudit, Lead } from '../types/database'

export async function qualifyLead(lead: Lead) {
  const { data, error } = await supabase.functions.invoke('ai-qualify', { body: { lead } })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error ?? 'AI qualification failed')
  return data.result as {
    score: number
    qualification: 'low' | 'medium' | 'high'
    reasoning: string
    recommended_action: string
    confidence: number
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
