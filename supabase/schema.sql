-- ====================================================================
-- SUPABASE DATABASE MIGRATION SCHEMA
-- ZA Media AI Growth Engine OS
-- Based strictly on src/types/database.ts
-- ====================================================================

-- 1. EXTENSIONS & SETUP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CUSTOM ENUM TYPES
CREATE TYPE pipeline_stage AS ENUM ('intake', 'qualified', 'discovery', 'proposal', 'closed_won');
CREATE TYPE lead_status AS ENUM ('Hot', 'Warm', 'Cold');
CREATE TYPE automation_status AS ENUM ('idle', 'running_n8n', 'whatsapp_queued', 'email_dispatched', 'error', 'completed');
CREATE TYPE user_role AS ENUM ('super_admin', 'executive', 'growth_ae', 'ai_agent_runner');
CREATE TYPE lead_source AS ENUM ('Web Form', 'LinkedIn Automation', 'Inbound WhatsApp', 'Cold Outreach', 'Meta Ad');
CREATE TYPE trigger_source AS ENUM ('webhook', 'cron', 'manual_override', 'ai_agent');
CREATE TYPE execution_status AS ENUM ('success', 'running', 'failed', 'retry');
CREATE TYPE channel_type AS ENUM ('whatsapp', 'email', 'linkedin', 'calendar_booking');
CREATE TYPE workflow_status AS ENUM ('pending', 'sent', 'skipped', 'failed');
CREATE TYPE content_platform AS ENUM ('linkedin', 'x', 'blog', 'newsletter', 'case_study');
CREATE TYPE content_status AS ENUM ('idea_draft', 'ai_generated', 'reviewed', 'scheduled', 'published');
CREATE TYPE ai_action_type AS ENUM ('lead_scored', 'whatsapp_dispatched', 'proposal_generated', 'mrr_projected', 'content_drafted');
CREATE TYPE initiated_by AS ENUM ('system', 'user', 'n8n_webhook');

-- 3. USER PROFILES TABLE
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'growth_ae',
  avatar_url TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ
);

-- 4. COMPANIES TABLE
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT NOT NULL,
  size_category TEXT,
  estimated_annual_revenue NUMERIC(15,2),
  country TEXT NOT NULL DEFAULT 'Egypt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. CONTACTS TABLE
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  job_title TEXT NOT NULL,
  is_decision_maker BOOLEAN NOT NULL DEFAULT false,
  linkedin_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. LEADS TABLE
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  avatar_url TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  source lead_source NOT NULL DEFAULT 'Web Form',
  industry TEXT NOT NULL,
  monthly_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  stage pipeline_stage NOT NULL DEFAULT 'intake',
  status lead_status NOT NULL DEFAULT 'Warm',
  last_activity TEXT NOT NULL DEFAULT 'Created',
  notes TEXT DEFAULT '',
  assigned_agent TEXT NOT NULL DEFAULT 'Unassigned',
  next_follow_up_at TIMESTAMPTZ,
  automation_status automation_status NOT NULL DEFAULT 'idle',
  likes_count INT NOT NULL DEFAULT 0,
  liked_by_me BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. AI QUALIFICATION SCORES TABLE
CREATE TABLE ai_qualification_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  overall_score INT NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  icp_fit_score INT NOT NULL CHECK (icp_fit_score >= 0 AND icp_fit_score <= 100),
  budget_match_score INT NOT NULL CHECK (budget_match_score >= 0 AND budget_match_score <= 100),
  authority_score INT NOT NULL CHECK (authority_score >= 0 AND authority_score <= 100),
  urgency_score INT NOT NULL CHECK (urgency_score >= 0 AND urgency_score <= 100),
  key_insights TEXT[] DEFAULT '{}',
  recommended_action TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'gemini-3.6-flash',
  prompt_used TEXT NOT NULL,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. PIPELINE STAGE HISTORY TABLE
CREATE TABLE pipeline_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_stage pipeline_stage,
  to_stage pipeline_stage NOT NULL,
  changed_by_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  changed_by_ai_agent TEXT,
  notes TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. AUTOMATION EVENTS TABLE (n8n Webhook Tracking)
CREATE TABLE automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  workflow_name TEXT NOT NULL,
  n8n_execution_id TEXT,
  trigger_source trigger_source NOT NULL DEFAULT 'webhook',
  status execution_status NOT NULL DEFAULT 'running',
  payload JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INT
);

-- 10. FOLLOW-UP WORKFLOWS TABLE
CREATE TABLE follow_up_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  channel channel_type NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status workflow_status NOT NULL DEFAULT 'pending',
  message_template TEXT NOT NULL,
  n8n_workflow_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. CONTENT ASSETS TABLE
CREATE TABLE content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  platform content_platform NOT NULL,
  status content_status NOT NULL DEFAULT 'idea_draft',
  body_text TEXT NOT NULL,
  ai_prompt_used TEXT,
  target_icp_category TEXT,
  published_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ
);

-- 11b. CONTENT POSTS TABLE (AI Content Agent)
CREATE TABLE IF NOT EXISTS content_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche TEXT NOT NULL DEFAULT 'Roofing & Services',
  headline TEXT NOT NULL,
  post TEXT NOT NULL,
  cta TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. AI ACTIONS LOG TABLE
CREATE TABLE ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type ai_action_type NOT NULL,
  initiated_by initiated_by NOT NULL DEFAULT 'system',
  details TEXT NOT NULL,
  target_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. INCOME RECORDS TABLE
CREATE TABLE income_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Retainer',
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
  status TEXT NOT NULL DEFAULT 'paid',
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. TASKS TABLE
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  assigned_to TEXT NOT NULL DEFAULT 'AI Growth Agent',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'todo',
  due_date TIMESTAMPTZ,
  related_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. GOALS TABLE
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  metric_type TEXT NOT NULL DEFAULT 'mrr',
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

-- 16. PRODUCTS TABLE
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'ai_automation',
  monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 17. COMMUNITY POSTS TABLE
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'Internal',
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. MENTOR RELATIONSHIPS TABLE
CREATE TABLE mentor_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_name TEXT NOT NULL,
  expertise_area TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  next_session_at TIMESTAMPTZ
);


-- ====================================================================
-- INDEXES FOR PERFORMANCE
-- ====================================================================
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_leads_company_id ON leads(company_id);
CREATE INDEX idx_leads_contact_id ON leads(contact_id);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_ai_scores_lead_id ON ai_qualification_scores(lead_id);
CREATE INDEX idx_pipeline_history_lead_id ON pipeline_stage_history(lead_id);
CREATE INDEX idx_automation_events_lead_id ON automation_events(lead_id);
CREATE INDEX idx_follow_up_lead_id ON follow_up_workflows(lead_id);

-- ====================================================================
-- AUTOMATIC TIMESTAMP TRIGGER
-- ====================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_timestamp BEFORE UPDATE ON companies FOR EACH ROW EXECUTE PROCEDURE update_timestamp_column();
CREATE TRIGGER update_leads_timestamp BEFORE UPDATE ON leads FOR EACH ROW EXECUTE PROCEDURE update_timestamp_column();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_qualification_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_relationships ENABLE ROW LEVEL SECURITY;

-- Default permissive read/write policy for authenticated service roles and OS users
CREATE POLICY "Allow all authenticated users full access" ON user_profiles FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON companies FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON leads FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON ai_qualification_scores FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON pipeline_stage_history FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON automation_events FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON follow_up_workflows FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON content_assets FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON ai_actions FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON income_records FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON goals FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON products FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON community_posts FOR ALL USING (true);
CREATE POLICY "Allow all authenticated users full access" ON mentor_relationships FOR ALL USING (true);
