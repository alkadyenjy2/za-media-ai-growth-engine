export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'appointment' | 'won' | 'lost'
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed'

export interface Company {
  id: string
  name: string
  industry: string
  status: 'active' | 'paused' | 'archived'
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SocialPage {
  id: string
  company_id: string
  name: string
  platform: string
  handle: string | null
  status: 'connected' | 'disconnected' | 'attention'
  followers: number
  created_at: string
  companies?: { name: string } | null
}

export interface Lead {
  id: string
  company_id: string | null
  page_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  property_address: string | null
  source: string
  status: LeadStatus
  score: number
  ai_score: number | null
  ai_qualification: 'low' | 'medium' | 'high' | null
  ai_reasoning: string | null
  ai_recommended_action: string | null
  ai_confidence: number | null
  ai_evaluated_at: string | null
  project_type: string
  estimated_value: number
  last_contacted_at: string | null
  created_at: string
  updated_at: string
  companies?: { name: string } | null
  social_pages?: { name: string } | null
}

export interface AiAudit {
  id: string
  company_id: string | null
  lead_id: string | null
  audit_type: string
  overall_score: number | null
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  recommended_actions: string[]
  priority: 'low' | 'medium' | 'high' | null
  source_data: Record<string, unknown>
  created_at: string
}

export interface ProspectProfile {
  id: string
  company_id: string
  canonical_name: string
  legal_name: string | null
  website_url: string | null
  domain: string | null
  industry: string | null
  sub_industry: string | null
  country: string | null
  city: string | null
  description: string | null
  lifecycle_status: 'discovered' | 'researching' | 'qualified' | 'engaged' | 'customer' | 'disqualified' | 'archived'
  fit_score: number | null
  intent_score: number | null
  opportunity_score: number | null
  priority_score: number | null
  confidence_score: number | null
  last_scored_at: string | null
  last_observed_at: string | null
  next_review_at: string | null
  profile_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ProspectEvidenceType = 'identity' | 'website' | 'social' | 'seo' | 'geo' | 'intent' | 'firmographic' | 'technographic' | 'behavior' | 'review' | 'campaign' | 'other'
export type ProspectSourceType = 'public' | 'first_party' | 'internal' | 'derived'

export interface ProspectEvidence {
  id: string
  prospect_id: string
  evidence_type: ProspectEvidenceType
  source_type: ProspectSourceType
  source_name: string
  source_url: string | null
  claim: string
  evidence_data: Record<string, unknown>
  confidence: number | null
  observed_at: string
  expires_at: string | null
  created_at: string
}

export type ProspectIntentSignalType = 'hiring' | 'expansion' | 'launch' | 'campaign' | 'website_change' | 'content_change' | 'leadership_change' | 'job_change' | 'ad_activity' | 'technology_change' | 'engagement' | 'other'

export interface ProspectIntentSignal {
  id: string
  prospect_id: string
  signal_type: ProspectIntentSignalType
  strength: number
  evidence_id: string | null
  signal_data: Record<string, unknown>
  detected_at: string
  expires_at: string | null
  created_at: string
}

export interface ProspectOpportunity {
  id: string
  prospect_id: string
  opportunity_type: string
  problem: string
  business_impact: string | null
  evidence_id: string | null
  opportunity_score: number | null
  status: 'identified' | 'reviewed' | 'approved' | 'rejected' | 'active' | 'won' | 'lost' | 'expired'
  opportunity_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ProspectServiceMatch {
  id: string
  prospect_id: string
  opportunity_id: string | null
  service_name: string
  offer_name: string | null
  rationale: string | null
  expected_outcome: string | null
  fit_score: number | null
  match_data: Record<string, unknown>
  created_at: string
}

export type ProspectOutreachChannel = 'email' | 'facebook' | 'instagram' | 'whatsapp' | 'phone' | 'other'
export type ProspectOutreachEventType = 'drafted' | 'reviewed' | 'approved' | 'sent' | 'delivered' | 'opened' | 'replied' | 'positive' | 'negative' | 'question' | 'not_now' | 'wrong_person' | 'unsubscribe' | 'no_response' | 'follow_up' | 'stopped'

export interface ProspectOutreachEvent {
  id: string
  prospect_id: string
  opportunity_id: string | null
  channel: ProspectOutreachChannel
  event_type: ProspectOutreachEventType
  content: string | null
  external_id: string | null
  metadata: Record<string, unknown>
  occurred_at: string
  created_at: string
}

export interface Campaign {
  id: string
  company_id: string | null
  page_id: string | null
  name: string
  objective: string
  status: CampaignStatus
  budget: number
  leads_count: number
  spend: number
  starts_at: string | null
  ends_at: string | null
  created_at: string
  companies?: { name: string } | null
}

export interface Conversation {
  id: string
  lead_id: string
  page_id: string | null
  channel: string
  status: 'open' | 'waiting' | 'closed'
  last_message_at: string
  created_at: string
  leads?: { full_name: string; phone: string | null; status: LeadStatus } | null
}

export interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  sender_name: string
  body: string
  ai_generated: boolean
  created_at: string
}

export interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  actor: string
  details: Record<string, unknown>
  created_at: string
}

export interface IncomeRecord {
  id: string
  company_id: string | null
  lead_id: string | null
  amount: number
  type: 'project' | 'retainer' | 'commission' | 'refund'
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  description: string | null
  recorded_at: string
  created_at: string
  companies?: { name: string } | null
}
