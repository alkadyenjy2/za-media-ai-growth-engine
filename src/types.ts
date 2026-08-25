export * from './types/database';

export type PipelineStage = 'intake' | 'qualified' | 'discovery' | 'proposal' | 'closed_won';

export interface AIQualificationScore {
  overallScore: number; // 0-100
  icpFitScore: number;
  budgetMatchScore: number;
  buyingIntentScore: number;
  decisionMakerVerified: boolean;
  keyInsights: string[];
  recommendedAction: string;
}

export interface LeadComment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  isAi?: boolean;
}

export interface SalesAutomationPackage {
  qualificationScore: number;
  icpFitScore: number;
  priority: 'P1 - Critical Hot' | 'P2 - High Priority' | 'P3 - Moderate' | 'P4 - Low / Nurture';
  bestResponseStrategy: string;
  emailSubject: string;
  emailBody: string;
  socialDmText: string;
  followUpTask: string;
  followUpDays: number;
  generatedAt: string;
  n8nDispatched?: boolean;
}

export interface Lead {
  id: string;
  contactName: string;
  companyName: string;
  avatarUrl?: string;
  email: string;
  phone: string;
  source: 'Web Form' | 'LinkedIn Automation' | 'Inbound WhatsApp' | 'Cold Outreach' | 'Meta Ad';
  industry: string;
  estimatedValue: number;
  monthlyBudget: number;
  stage: PipelineStage;
  score: AIQualificationScore;
  status: 'Hot' | 'Warm' | 'Cold';
  createdAt: string;
  lastActivity: string;
  notes: string;
  assignedAgent: string;
  likesCount?: number;
  likedByMe?: boolean;
  comments?: LeadComment[];
  salesAutomation?: SalesAutomationPackage;
}

export interface StoryItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'hot_lead' | 'followup' | 'revenue' | 'content' | 'ai_insight';
  badge: string;
  avatarUrl: string;
  isUnread: boolean;
  content: {
    headline: string;
    details: string[];
    actionText: string;
    metrics?: string;
  };
}

export interface RevenueMetrics {
  totalPipelineValue: number;
  mrrProjected: number;
  closedRevenueMtd: number;
  conversionRatePercent: number;
  avgDealSize: number;
  avgQualificationSpeedSec: number;
}

export type ContentStatus = 'Draft' | 'Approved' | 'Published';

export interface ContentPost {
  id: string;
  niche: string;
  headline: string;
  post: string;
  cta: string;
  targetAudience: string;
  imagePrompt: string;
  hashtags: string[];
  status: ContentStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'intake' | 'qualification' | 'crm_update' | 'automation_triggered' | 'followup_sent';
  title: string;
  description: string;
  leadName: string;
  status: 'success' | 'pending' | 'info';
}

