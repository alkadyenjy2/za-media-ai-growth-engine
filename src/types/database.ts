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
  project_type: string
  estimated_value: number
  last_contacted_at: string | null
  created_at: string
  updated_at: string
  companies?: { name: string } | null
  social_pages?: { name: string } | null
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
