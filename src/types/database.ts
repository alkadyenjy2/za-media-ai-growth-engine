// Supabase & Production Database Schema Types for ZA Media AI Growth Engine OS

export type DatabaseUuid = string;
export type ISO8601Timestamp = string;

export type PipelineStage = 'intake' | 'qualified' | 'discovery' | 'proposal' | 'closed_won';
export type LeadStatus = 'Hot' | 'Warm' | 'Cold';
export type AutomationStatus = 'idle' | 'running_n8n' | 'whatsapp_queued' | 'email_dispatched' | 'error' | 'completed';

export interface UserProfile {
  id: DatabaseUuid;
  email: string;
  fullName: string;
  role: 'super_admin' | 'executive' | 'growth_ae' | 'ai_agent_runner';
  avatarUrl?: string;
  department?: string;
  createdAt: ISO8601Timestamp;
  lastActiveAt?: ISO8601Timestamp;
}

export interface Company {
  id: DatabaseUuid;
  name: string;
  domain?: string;
  industry: string;
  sizeCategory?: string;
  estimatedAnnualRevenue?: number;
  country: string;
  createdAt: ISO8601Timestamp;
  updatedAt: ISO8601Timestamp;
}

export interface Contact {
  id: DatabaseUuid;
  companyId: DatabaseUuid;
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  isDecisionMaker: boolean;
  linkedinUrl?: string;
  createdAt: ISO8601Timestamp;
}

export interface PipelineStageHistory {
  id: DatabaseUuid;
  leadId: DatabaseUuid;
  fromStage: PipelineStage | null;
  toStage: PipelineStage;
  changedByUserId?: DatabaseUuid;
  changedByAiAgent?: string;
  notes?: string;
  timestamp: ISO8601Timestamp;
}

export interface AIQualificationScore {
  id: DatabaseUuid;
  leadId: DatabaseUuid;
  overallScore: number; // 0 - 100
  icpFitScore: number;
  budgetMatchScore: number;
  authorityScore: number;
  urgencyScore: number;
  keyInsights: string[];
  recommendedAction: string;
  modelVersion: string; // e.g., 'gemini-3.6-flash'
  promptUsed: string;
  scoredAt: ISO8601Timestamp;
}

export interface LeadDbRecord {
  id: DatabaseUuid;
  companyId: DatabaseUuid;
  contactId: DatabaseUuid;
  contactName: string;
  companyName: string;
  avatarUrl?: string;
  email: string;
  phone: string;
  source: 'Web Form' | 'LinkedIn Automation' | 'Inbound WhatsApp' | 'Cold Outreach' | 'Meta Ad';
  industry: string;
  monthlyBudget: number;
  estimatedValue: number;
  stage: PipelineStage;
  status: LeadStatus;
  score: AIQualificationScore;
  pipelineHistory: PipelineStageHistory[];
  lastActivity: string;
  notes: string;
  assignedAgent: string;
  nextFollowUpAt?: ISO8601Timestamp;
  automationStatus: AutomationStatus;
  likesCount: number;
  likedByMe: boolean;
  createdAt: ISO8601Timestamp;
  updatedAt: ISO8601Timestamp;
}

export interface AutomationEvent {
  id: DatabaseUuid;
  leadId?: DatabaseUuid;
  workflowName: string;
  n8nExecutionId?: string;
  triggerSource: 'webhook' | 'cron' | 'manual_override' | 'ai_agent';
  status: 'success' | 'running' | 'failed' | 'retry';
  payload: Record<string, any>;
  errorMessage?: string;
  executedAt: ISO8601Timestamp;
  durationMs?: number;
}

export interface FollowUpWorkflow {
  id: DatabaseUuid;
  leadId: DatabaseUuid;
  title: string;
  channel: 'whatsapp' | 'email' | 'linkedin' | 'calendar_booking';
  scheduledAt: ISO8601Timestamp;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
  messageTemplate: string;
  n8nWorkflowId: string;
  createdAt: ISO8601Timestamp;
}

export interface ContentAsset {
  id: DatabaseUuid;
  title: string;
  platform: 'linkedin' | 'x' | 'blog' | 'newsletter' | 'case_study';
  status: 'idea_draft' | 'ai_generated' | 'reviewed' | 'scheduled' | 'published';
  bodyText: string;
  aiPromptUsed?: string;
  targetIcpCategory?: string;
  publishedUrl?: string;
  createdAt: ISO8601Timestamp;
  scheduledFor?: ISO8601Timestamp;
}

export interface AIAction {
  id: DatabaseUuid;
  actionType: 'lead_scored' | 'whatsapp_dispatched' | 'proposal_generated' | 'mrr_projected' | 'content_drafted';
  initiatedBy: 'system' | 'user' | 'n8n_webhook';
  details: string;
  targetId?: DatabaseUuid;
  timestamp: ISO8601Timestamp;
}

export interface IncomeRecord {
  id: DatabaseUuid;
  clientName: string;
  amount: number;
  category: string;
  paymentMethod: string;
  status: 'paid' | 'pending' | 'overdue';
  transactionDate: ISO8601Timestamp;
  createdAt: ISO8601Timestamp;
}

export interface TaskItem {
  id: DatabaseUuid;
  title: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'done';
  dueDate?: ISO8601Timestamp;
  relatedLeadId?: DatabaseUuid;
  createdAt: ISO8601Timestamp;
}

export interface GoalItem {
  id: DatabaseUuid;
  title: string;
  targetAmount: number;
  currentAmount: number;
  metricType: 'mrr' | 'pipeline' | 'closed_deals' | 'content_posts';
  deadline: ISO8601Timestamp;
  status: 'active' | 'completed' | 'behind';
}

export interface ProductPackage {
  id: DatabaseUuid;
  name: string;
  category: 'social_media' | 'content' | 'ai_automation' | 'ads' | 'branding';
  monthlyPrice: number;
  description: string;
  features: string[];
  isActive: boolean;
}

export interface CommunityPost {
  id: DatabaseUuid;
  authorName: string;
  authorAvatar?: string;
  title: string;
  content: string;
  platform: string;
  likesCount: number;
  commentsCount: number;
  createdAt: ISO8601Timestamp;
}

export interface MentorRelationship {
  id: DatabaseUuid;
  mentorName: string;
  expertiseArea: string;
  status: 'active' | 'scheduled' | 'completed';
  notes?: string;
  nextSessionAt?: ISO8601Timestamp;
}

