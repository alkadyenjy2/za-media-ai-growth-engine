import { createClient } from '@supabase/supabase-js';
import { Lead, PipelineStage, ActivityLog, ContentPost, ContentStatus } from '../types';

const getEnvVar = (viteKey: string, nodeKey?: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
    return import.meta.env[viteKey];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[viteKey] || (nodeKey ? process.env[nodeKey] : undefined);
  }
  return undefined;
};

const rawUrl = getEnvVar('VITE_SUPABASE_URL', 'SUPABASE_URL');
const rawKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');

export interface SupabaseKeysValidation {
  isValid: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  missingKeys: string[];
}

const isValidHttpUrl = (url?: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Helper function to validate if both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are valid non-empty strings.
 */
export function validateSupabaseKeys(): SupabaseKeysValidation {
  const url = getEnvVar('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');

  const hasValidUrl = typeof url === 'string' && url.trim().length > 0 && isValidHttpUrl(url);
  const hasAnonKey = typeof anonKey === 'string' && anonKey.trim().length > 0;

  const missingKeys: string[] = [];
  if (!hasValidUrl) {
    missingKeys.push(
      url && !isValidHttpUrl(url) 
        ? 'VITE_SUPABASE_URL (Must be a valid HTTP/HTTPS URL, e.g., https://xyz.supabase.co)' 
        : 'VITE_SUPABASE_URL'
    );
  }
  if (!hasAnonKey) missingKeys.push('VITE_SUPABASE_ANON_KEY');

  return {
    isValid: hasValidUrl && hasAnonKey,
    hasUrl: hasValidUrl,
    hasAnonKey,
    missingKeys,
  };
}

export const isSupabaseConfigured = Boolean(
  validateSupabaseKeys().isValid && isValidHttpUrl(rawUrl) && rawKey !== 'placeholder-key'
);

const validUrl = isValidHttpUrl(rawUrl) ? rawUrl! : 'https://placeholder.supabase.co';
const validKey = rawKey && rawKey.trim().length > 0 ? rawKey : 'placeholder-key';

export const supabase = createClient(validUrl, validKey);

export async function getCurrentOrganizationId(): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Authenticated user is required.');

  const { data, error } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .limit(1)
    .maybeSingle();

  if (error || !data?.organization_id) {
    throw new Error('The authenticated user is not assigned to an organization.');
  }
  return data.organization_id as string;
}

/**
 * Helper to fetch leads from Supabase 'leads' table
 */
export async function fetchLeadsFromSupabase(): Promise<Lead[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchLeads query failed:', {
        supabaseUrl: validUrl,
        table: 'leads',
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return null;
    }

    if (!data) return [];

    const leadIds = data.map((row) => row.id).filter(Boolean);
    const { data: scoreRows, error: scoreError } = leadIds.length > 0
      ? await supabase
          .from('ai_qualification_scores')
          .select('lead_id, overall_score, icp_fit_score, budget_match_score, authority_score, key_insights, recommended_action')
          .in('lead_id', leadIds)
      : { data: [], error: null };

    if (scoreError) {
      console.warn('Supabase qualification score query failed:', scoreError.message);
    }
    const scoresByLeadId = new Map((scoreRows || []).map((score) => [score.lead_id, score]));

    return data.map((row) => {
      const scoreRow = scoresByLeadId.get(row.id);
      return ({
      id: row.id,
      contactName: row.contact_name,
      companyName: row.company_name,
      avatarUrl: row.avatar_url,
      email: row.email,
      phone: row.phone,
      source: row.source,
      industry: row.industry,
      estimatedValue: Number(row.estimated_value) || 0,
      monthlyBudget: Number(row.monthly_budget) || 0,
      stage: row.stage as PipelineStage,
      status: row.status,
      createdAt: row.created_at,
      lastActivity: row.last_activity || 'Created',
      notes: row.notes || '',
      assignedAgent: row.assigned_agent || 'AI Growth Engine',
      likesCount: row.likes_count || 0,
      likedByMe: row.liked_by_me || false,
      score: {
        overallScore: Number(scoreRow?.overall_score) || 0,
        icpFitScore: Number(scoreRow?.icp_fit_score) || 0,
        budgetMatchScore: Number(scoreRow?.budget_match_score) || 0,
        buyingIntentScore: Number(scoreRow?.authority_score) || 0,
        decisionMakerVerified: Boolean(scoreRow),
        keyInsights: Array.isArray(scoreRow?.key_insights) ? scoreRow.key_insights : [],
        recommendedAction: scoreRow?.recommended_action || 'Awaiting qualification'
      }
    });
    });
  } catch (err: any) {
    console.error('Failed to fetch from Supabase:', {
      supabaseUrl: validUrl,
      table: 'leads',
      message: err?.message,
      code: err?.code
    });
    return null;
  }
}

/**
 * Save a new Lead to Supabase
 */
export async function insertLeadToSupabase(lead: Lead): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const organizationId = await getCurrentOrganizationId();
    const isUuid = (id?: string) => Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    const validLeadId = isUuid(lead.id) ? lead.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0'));
    const companyId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + (Date.now() + 1).toString(16).padStart(12, '0');
    const contactId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + (Date.now() + 2).toString(16).padStart(12, '0');

    // 1. Ensure Company row exists if companies table is present
    try {
      const { error: companyError } = await supabase.from('companies').upsert([
        {
          id: companyId,
          organization_id: organizationId,
          name: lead.companyName || 'Target Company',
          industry: lead.industry || 'Roofing & Construction',
          country: 'Egypt'
        }
      ], { onConflict: 'id' });
      if (companyError) throw companyError;
    } catch (error) {
      console.error('Supabase company persistence failed:', error);
      return false;
    }

    // 2. Ensure Contact row exists if contacts table is present
    try {
      const { error: contactError } = await supabase.from('contacts').upsert([
        {
          id: contactId,
          organization_id: organizationId,
          company_id: companyId,
          full_name: lead.contactName || 'Valued Prospect',
          email: lead.email,
          phone: lead.phone,
          job_title: 'Decision Maker',
          is_decision_maker: true
        }
      ], { onConflict: 'id' });
      if (contactError) throw contactError;
    } catch (error) {
      console.error('Supabase contact persistence failed:', error);
      return false;
    }

    // 3. Insert / Upsert into public.leads table
    const leadPayload: any = {
      id: validLeadId,
      organization_id: organizationId,
      contact_name: lead.contactName,
      company_name: lead.companyName,
      avatar_url: lead.avatarUrl || null,
      email: lead.email,
      phone: lead.phone,
      source: lead.source || 'Web Form',
      industry: lead.industry || 'Roofing Services',
      monthly_budget: lead.monthlyBudget || 0,
      estimated_value: lead.estimatedValue || 0,
      stage: lead.stage || 'intake',
      status: lead.status || 'Warm',
      last_activity: lead.lastActivity || 'Lead Ingested',
      notes: lead.notes || '',
      assigned_agent: lead.assignedAgent || 'AI Growth Engine',
      company_id: companyId,
      contact_id: contactId,
      created_at: lead.createdAt && lead.createdAt !== 'Just now' ? lead.createdAt : new Date().toISOString()
    };

    const { error } = await supabase.from('leads').upsert([leadPayload], { onConflict: 'id' });

    if (error) {
      console.error('Supabase public.leads upsert failed:', error.message);
      return false;
    }

    // 4. Save AI qualification score if present
    if (lead.score) {
      try {
        const { error: scoreError } = await supabase.from('ai_qualification_scores').upsert([
          {
            organization_id: organizationId,
            lead_id: validLeadId,
            overall_score: lead.score.overallScore,
            icp_fit_score: lead.score.icpFitScore,
            budget_match_score: lead.score.budgetMatchScore,
            authority_score: lead.score.buyingIntentScore,
            urgency_score: lead.score.buyingIntentScore,
            key_insights: lead.score.keyInsights,
            recommended_action: lead.score.recommendedAction,
            model_version: 'gemini-3.6-flash',
            prompt_used: 'Gemini AI Lead Qualification Engine'
          }
        ], { onConflict: 'lead_id' });
        if (scoreError) {
          console.error('Supabase qualification score persistence failed:', scoreError.message);
          return false;
        }
      } catch (error) {
        console.error('Supabase qualification score persistence failed:', error);
        return false;
      }

      // Record audit event in ai_actions table
      const auditSuccess = await logAiActionToSupabase({
        agent_name: 'Gemini AI Lead Qualification',
        action_type: 'lead_scored',
        target_lead_id: validLeadId,
        organization_id: organizationId,
        payload: {
          companyName: lead.companyName,
          overallScore: lead.score.overallScore,
          status: lead.status,
          recommendedAction: lead.score.recommendedAction,
          keyInsights: lead.score.keyInsights
        },
        status: 'success'
      });
      if (!auditSuccess) return false;
    }

    console.log('✅ Lead successfully written to public.leads table in Supabase:', validLeadId);
    return true;
  } catch (err) {
    console.error('Failed to insert lead into Supabase:', err);
    return false;
  }
}

/**
 * Update lead stage in Supabase
 */
export async function updateLeadStageInSupabase(leadId: string, newStage: PipelineStage): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase
      .from('leads')
      .update({
        stage: newStage,
        last_activity: `Stage updated to ${newStage}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);

    if (error) {
      console.warn('Supabase updateLeadStage error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to update stage in Supabase:', err);
    return false;
  }
}

/**
 * Clear leads in Supabase
 */
export async function clearLeadsInSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.warn('Supabase clearLeads error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to clear leads in Supabase:', err);
    return false;
  }
}

/**
 * Fetch products from Supabase
 */
export async function fetchProductsFromSupabase() {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch income records from Supabase joined with leads table
 */
export async function fetchIncomeRecordsFromSupabase() {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('income_records')
      .select('*, leads(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Primary income_records join query warning:', error.message);
      // Fallback if foreign key relationship is not configured
      const { data: fallbackData } = await supabase
        .from('income_records')
        .select('*')
        .order('created_at', { ascending: false });
      return fallbackData;
    }
    return data;
  } catch (err) {
    console.error('Failed to fetch income records:', err);
    return null;
  }
}

/**
 * Fetch tasks from Supabase
 */
export async function fetchTasksFromSupabase() {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch activity logs from Supabase 'ai_actions' table
 */
export async function fetchActivityLogsFromSupabase(): Promise<ActivityLog[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('ai_actions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error) {
      console.warn('Supabase fetchActivityLogs error:', error.message);
      return null;
    }

    if (!data) return [];

    return data.map((row): ActivityLog => ({
      id: row.id,
      timestamp: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: row.action_type || 'qualification',
      title: row.action_type === 'lead_scored' ? 'AI Qualification Completed' : 
             row.action_type === 'whatsapp_dispatched' ? 'WhatsApp Follow-up Dispatched' : 
             row.action_type === 'proposal_generated' ? 'Proposal AI Generated' : 'AI Engine Event',
      description: row.details || 'System activity processed',
      leadName: row.target_id ? 'Client Lead' : 'System',
      status: 'success'
    }));
  } catch (err) {
    console.error('Failed to fetch activity logs:', err);
    return null;
  }
}

/**
 * Insert activity log into Supabase 'ai_actions' table
 */
export async function insertActivityLogToSupabase(log: { title: string; description: string; type?: string }) {
  if (!isSupabaseConfigured) return false;
  try {
    const organizationId = await getCurrentOrganizationId();
    const { error } = await supabase.from('ai_actions').insert([
      {
        organization_id: organizationId,
        action_type: 'lead_scored',
        initiated_by: 'user',
        details: `${log.title}: ${log.description}`,
        timestamp: new Date().toISOString()
      }
    ]);

    if (error) {
      console.warn('Supabase insertActivityLog error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to insert activity log:', err);
    return false;
  }
}

/**
 * Insert structured AI Action into Supabase 'ai_actions' table
 */
export async function logAiActionToSupabase(action: {
  agent_name: string;
  action_type: string;
  target_lead_id?: string;
  organization_id?: string;
  payload: any;
  status: 'success' | 'failed' | 'pending';
}) {
  if (!isSupabaseConfigured) return false;

  try {
    const organizationId = action.organization_id || await getCurrentOrganizationId();
    const isUuid = (id?: string) => Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    const targetId = isUuid(action.target_lead_id) ? action.target_lead_id : null;
    const validAuditId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');

    const { error: auditError } = await supabase.from('audit_logs').insert([{
      id: validAuditId,
      organization_id: organizationId,
      title: `${action.agent_name}: ${action.action_type}`,
      description: typeof action.payload === 'string' ? action.payload : JSON.stringify(action.payload),
      type: 'automation',
      lead_name: action.payload?.companyName || action.payload?.contactName || targetId || 'General',
      status: action.status,
      created_at: new Date().toISOString()
    }]);
    if (auditError) throw new Error(`audit_logs write failed: ${auditError.message}`);

    const allowedActionTypes = ['lead_scored', 'whatsapp_dispatched', 'proposal_generated', 'mrr_projected', 'content_drafted'];
    const validActionType = allowedActionTypes.includes(action.action_type) ? action.action_type : 'lead_scored';
    const detailsObj = typeof action.payload === 'string'
      ? { agent: action.agent_name, details: action.payload }
      : { agent: action.agent_name, original_type: action.action_type, ...action.payload };

    const { error: actionError } = await supabase.from('ai_actions').insert([{
      organization_id: organizationId,
      action_type: validActionType,
      target_id: targetId,
      initiated_by: 'system',
      details: JSON.stringify(detailsObj),
      timestamp: new Date().toISOString()
    }]);
    if (actionError) throw new Error(`ai_actions write failed: ${actionError.message}`);

    return true;
  } catch (err) {
    console.error('Failed to log AI action:', err);
    return false;
  }
}

/**
 * Fetch raw records from 'ai_actions' table in Supabase to verify audit events
 */
export async function fetchRawAiActionsFromSupabase(limit = 10): Promise<{ action_type: string; lead_id: string | null; timestamp: string; details: any }[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('ai_actions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('Supabase fetchRawAiActions error:', error.message);
      return null;
    }

    if (!data) return [];

    const records = data.map((row: any) => ({
      action_type: row.action_type,
      lead_id: row.target_id || null,
      timestamp: row.timestamp,
      details: row.details
    }));

    console.log('📋 Verified Supabase ai_actions records:', records);
    return records;
  } catch (err) {
    console.error('Failed to fetch raw ai_actions:', err);
    return null;
  }
}

/**
 * Fetch content posts from Supabase 'content_posts' table
 */
export async function fetchContentPostsFromSupabase(): Promise<ContentPost[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('content_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchContentPosts error:', error.message);
      return null;
    }

    if (!data) return [];

    return data.map((row): ContentPost => ({
      id: row.id,
      niche: row.niche || 'Roofing & Services',
      headline: row.headline || '',
      post: row.post || '',
      cta: row.cta || '',
      targetAudience: row.target_audience || '',
      imagePrompt: row.image_prompt || '',
      hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
      status: (row.status as ContentStatus) || 'Draft',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at
    }));
  } catch (err) {
    console.error('Failed to fetch content posts:', err);
    return null;
  }
}

/**
 * Insert a content post into Supabase 'content_posts' table
 */
export async function insertContentPostToSupabase(post: ContentPost): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const organizationId = await getCurrentOrganizationId();
    const payload = {
      organization_id: organizationId,
      niche: post.niche,
      headline: post.headline,
      post: post.post,
      cta: post.cta,
      target_audience: post.targetAudience,
      image_prompt: post.imagePrompt,
      hashtags: post.hashtags,
      status: post.status || 'Draft',
      created_at: post.createdAt || new Date().toISOString()
    };

    const { error } = await supabase
      .from('content_posts')
      .insert([payload]);

    if (error) {
      console.warn('Supabase insertContentPost error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to insert content post:', err);
    return false;
  }
}

/**
 * Update content post status in Supabase
 */
export async function updateContentPostStatusInSupabase(id: string, status: ContentStatus): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('content_posts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn('Supabase updateContentPostStatus error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to update content post status:', err);
    return false;
  }
}

/**
 * Delete a content post from Supabase
 */
export async function deleteContentPostFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('content_posts')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase deleteContentPost error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to delete content post:', err);
    return false;
  }
}

/**
 * Insert activity record into dedicated 'audit_logs' table in Supabase
 */
export async function insertAuditLogToSupabase(log: { title: string; description: string; type?: string; leadName?: string; status?: string }): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const organizationId = await getCurrentOrganizationId();
    const payload = {
      organization_id: organizationId,
      title: log.title,
      description: log.description,
      type: log.type || 'qualification',
      lead_name: log.leadName || 'System',
      status: log.status || 'success',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('audit_logs').insert([payload]);

    if (error) {
      console.error('Supabase audit_logs insert failed:', error.message);
      return false;
    }

    console.log('✅ Activity written to public.audit_logs table in Supabase:', log.title);
    return true;
  } catch (err) {
    console.error('Failed to insert audit log to Supabase:', err);
    return false;
  }
}

/**
 * Fetch activity records from dedicated 'audit_logs' table in Supabase
 */
export async function fetchAuditLogsFromSupabase(): Promise<ActivityLog[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) {
      // Fallback query to ai_actions table if audit_logs table is empty or missing
      return await fetchActivityLogsFromSupabase();
    }

    return data.map((row: any): ActivityLog => ({
      id: row.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date(row.created_at || row.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: row.type || 'qualification',
      title: row.title || 'System Activity Log',
      description: row.description || '',
      leadName: row.lead_name || 'System',
      status: row.status || 'success'
    }));
  } catch (err) {
    console.error('Failed to fetch audit logs from Supabase:', err);
    return await fetchActivityLogsFromSupabase();
  }
}


