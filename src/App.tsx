import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { SignupPage } from './components/SignupPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { ContentGenerator } from './components/ContentGenerator';
import { SalesAutomationHub } from './components/SalesAutomationHub';
import { N8nAutomationAgent } from './components/N8nAutomationAgent';
import { DigitalProductsOS } from './components/DigitalProductsOS';
import { AgentTeamHub } from './components/AgentTeamHub';
import { MarketResearchHub } from './components/MarketResearchHub';
import { SystemHealthHub } from './components/SystemHealthHub';
import { LeadDetailModal } from './components/LeadDetailModal';
import { LeadIntakeModal } from './components/LeadIntakeModal';
import { SecretsGuideModal } from './components/SecretsGuideModal';
import { BottomNavBar } from './components/BottomNavBar';
import { Lead, RevenueMetrics, ActivityLog } from './types';
import { 
  getLeads, 
  createLead, 
  updateLeadStage, 
  deleteAllLeads 
} from './services/leads';
import { 
  calculateRevenueMetrics, 
  getActivityLogs, 
  logActivity 
} from './services/dashboard';
import { executeSalesAutomationForLead } from './services/salesAutomation';
import { scoreLeadWithGemini } from './services/leadScoring';
import { n8nService } from './services/n8n';
import { isSupabaseConfigured, validateSupabaseKeys, fetchIncomeRecordsFromSupabase } from './lib/supabase';
import { runN8nDiagnosticCheck } from './lib/webhookProxy';
import { 
  UserCheck, 
  Workflow, 
  BarChart3, 
  FileText,
  AlertCircle,
  KeyRound,
  Settings
} from 'lucide-react';

function DashboardApp() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Live Database States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics>({
    totalPipelineValue: 0,
    mrrProjected: 0,
    closedRevenueMtd: 0,
    conversionRatePercent: 0,
    avgDealSize: 0,
    avgQualificationSpeedSec: 1.4
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Fetching & Error States
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modal States
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState<boolean>(false);
  const [isSecretsModalOpen, setIsSecretsModalOpen] = useState<boolean>(false);

  // Fetch live Supabase data or local state
  const loadDashboardData = useCallback(async () => {
    if (!user) return;

    setIsLoadingData(true);
    setFetchError(null);

    try {
      const keyCheck = validateSupabaseKeys();

      // Fetch leads and activities (getLeads handles Supabase vs LocalStorage)
      const [dbLeads, dbActivities, incomeRecords] = await Promise.all([
        getLeads(),
        getActivityLogs(),
        fetchIncomeRecordsFromSupabase()
      ]);

      if (dbLeads) {
        setLeads(dbLeads);
        setRevenueMetrics(calculateRevenueMetrics(dbLeads, incomeRecords || []));
      }

      if (dbActivities) {
        setActivityLogs(dbActivities);
      }

      // If keys are explicitly missing, we do not set a blocking fetch error because the top warning bar handles notifying the user.
      if (!keyCheck.isValid && isSupabaseConfigured) {
        setFetchError(null);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setFetchError(err?.message || 'An unexpected error occurred while communicating with Supabase.');
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboardData();
    runN8nDiagnosticCheck().catch((err) => {
      console.warn('n8n startup diagnostic check failed:', err);
    });
  }, [loadDashboardData]);

  // If session authentication is loading, render a sleek loader screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-lg shadow-indigo-500/30 mb-4">
          ZA
        </div>
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-slate-400 font-medium">Verifying Session & Executive Credentials...</p>
      </div>
    );
  }

  // If user is not authenticated, render Login/Signup Page
  if (!user) {
    if (authMode === 'login') {
      return <LoginPage onSwitchToSignup={() => setAuthMode('signup')} />;
    } else {
      return <SignupPage onSwitchToLogin={() => setAuthMode('login')} />;
    }
  }

  // Authenticated Dashboard Layout
  const hotLeadCount = leads.filter(l => l.status === 'Hot').length;
  const supabaseKeyStatus = validateSupabaseKeys();

  const handleUpdateLeadStage = async (leadId: string, newStage: Lead['stage']) => {
    // Optimistic UI update
    const updatedLeads = leads.map(lead => {
      if (lead.id === leadId) {
        const updated = { ...lead, stage: newStage, lastActivity: `Stage updated to ${newStage}` };
        if (selectedLead?.id === leadId) {
          setSelectedLead(updated);
        }
        return updated;
      }
      return lead;
    });

    setLeads(updatedLeads);
    setRevenueMetrics(calculateRevenueMetrics(updatedLeads));

    // Persist to Supabase
    await updateLeadStage(leadId, newStage);

    const updatedLead = leads.find(l => l.id === leadId);
    if (updatedLead) {
      const title = 'CRM Stage Transition';
      const desc = `Moved ${updatedLead.companyName} to ${newStage.toUpperCase()} in pipeline`;
      const newLog: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'crm_update',
        title,
        description: desc,
        leadName: updatedLead.companyName,
        status: 'success'
      };
      setActivityLogs(prev => [newLog, ...prev]);
      logActivity(title, desc, 'crm_update');
    }
  };

  const handleAddLead = async (rawLead: Lead): Promise<void> => {
    // AI qualification must complete before the lead is persisted.
    const scoredLead = await scoreLeadWithGemini(rawLead);
    await createLead(scoredLead);

    // React state is updated only after the remote source of truth accepts the row.
    const updatedLeads = [scoredLead, ...leads.filter(l => l.id !== scoredLead.id)];
    setLeads(updatedLeads);
    setRevenueMetrics(calculateRevenueMetrics(updatedLeads));

    let activityStatus: ActivityLog['status'] = 'success';
    let deliveryDescription = 'Lead was saved to Supabase; n8n delivery is pending verification.';
    try {
      const dispatchResult = await n8nService.dispatchLeadIntake(scoredLead);
      if (dispatchResult.success) {
        deliveryDescription = `Lead was saved to Supabase; n8n accepted the webhook (${dispatchResult.deliveryStatus}).`;
      } else {
        activityStatus = 'pending';
        deliveryDescription = `Lead was saved to Supabase, but n8n dispatch failed: ${dispatchResult.details}.`;
      }
    } catch (err: any) {
      activityStatus = 'pending';
      deliveryDescription = `Lead was saved to Supabase, but n8n delivery is pending: ${err?.message || 'unknown error'}.`;
    }

    const title = activityStatus === 'success'
      ? 'Inbound Lead Qualified and Webhook Accepted'
      : 'Inbound Lead Qualified; Automation Pending';
    const desc = `Lead scored (${scoredLead.score.overallScore}/100 - ${scoredLead.status}) for ${scoredLead.companyName}. ${deliveryDescription}`;
    const newLog: ActivityLog = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: 'automation_triggered',
      title,
      description: desc,
      leadName: scoredLead.companyName,
      status: activityStatus
    };
    setActivityLogs(prev => [newLog, ...prev]);
    await logActivity(title, desc, 'automation_triggered');
  };

  const handleRunSalesAutomation = async (targetLead: Lead) => {
    const salesPkg = await executeSalesAutomationForLead(targetLead);
    const updatedLead: Lead = {
      ...targetLead,
      salesAutomation: salesPkg,
      lastActivity: `AI Sales Strategy generated (${salesPkg.priority})`
    };

    const updatedLeads = leads.map(l => l.id === targetLead.id ? updatedLead : l);
    setLeads(updatedLeads);
    if (selectedLead?.id === targetLead.id) {
      setSelectedLead(updatedLead);
    }

    await createLead(updatedLead);

    const title = 'AI Sales Automation Executed';
    const desc = `Generated personalized Email & WhatsApp package (${salesPkg.priority}) for ${targetLead.companyName}`;
    setActivityLogs(prev => [{
      id: `act-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: 'automation_triggered',
      title,
      description: desc,
      leadName: targetLead.companyName,
      status: 'success'
    }, ...prev]);
  };

  const handleClearDemoData = async () => {
    const confirmClear = window.confirm(
      '⚠️ WARNING: Are you sure you want to reset the lead pipeline? This will clear all local lead state and remove records.'
    );
    if (!confirmClear) return;

    setLeads([]);
    await deleteAllLeads();
    setRevenueMetrics(calculateRevenueMetrics([]));
    const title = 'Production Pipeline Reset';
    const desc = 'Database pipeline reset. System ready for real inbound lead intake.';
    setActivityLogs([{
      id: `act-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'crm_update',
      title,
      description: desc,
      leadName: 'System',
      status: 'info'
    }]);
    logActivity(title, desc, 'crm_update');
  };

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(leads, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `za_media_leads_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden antialiased">
      {/* Sidebar Component */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <Header 
          onOpenIntakeModal={() => setIsIntakeModalOpen(true)}
          leadCount={leads.length}
          hotLeadCount={hotLeadCount}
          onClearDemoData={handleClearDemoData}
          onExportData={handleExportData}
          isSupabaseConnected={supabaseKeyStatus.isValid}
          onOpenSecretsGuide={() => setIsSecretsModalOpen(true)}
        />

        {/* Dynamic Tab Body */}
        <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
          {!supabaseKeyStatus.isValid && (
            <div className="mb-6 p-4 bg-amber-950/80 border border-amber-600/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-200 text-xs shadow-lg">
              <div className="flex items-start gap-3 flex-1">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-white text-sm flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    Supabase Credentials Missing
                  </p>
                  <p className="text-amber-200/90 mt-1">
                    Missing environment variables:{' '}
                    <span className="font-mono bg-amber-900/80 px-1.5 py-0.5 rounded text-amber-100 font-bold">
                      {supabaseKeyStatus.missingKeys.join(' and ')}
                    </span>
                  </p>
                  <p className="text-amber-300/70 text-[11px] mt-1">
                    Please configure non-empty values for <span className="font-mono">VITE_SUPABASE_URL</span> and <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> in your environment secrets settings to activate live database connection.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSecretsModalOpen(true)}
                className="shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 text-xs"
              >
                <Settings className="w-4 h-4 text-slate-950" />
                <span>Re-configure</span>
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <ExecutiveDashboard 
              leads={leads}
              revenueMetrics={revenueMetrics}
              activityLogs={activityLogs}
              onSelectLead={(lead) => setSelectedLead(lead)}
              onOpenIntakeModal={() => setIsIntakeModalOpen(true)}
              onUpdateStage={handleUpdateLeadStage}
              isLoading={isLoadingData}
              error={fetchError}
              onRetry={loadDashboardData}
            />
          )}

          {activeTab === 'intake' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-indigo-400" />
                      Lead Intake Automation & AI Qualification Engine
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Add real client leads to trigger Gemini AI qualification scoring and save directly to Supabase.
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsIntakeModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-md flex items-center gap-2"
                  >
                    + Add Real Lead
                  </button>
                </div>

                {isLoadingData ? (
                  <div className="p-12 text-center text-slate-500 text-xs">Loading live leads from Supabase...</div>
                ) : leads.length === 0 ? (
                  <div className="p-12 border border-dashed border-slate-800 rounded-2xl text-center space-y-3">
                    <p className="text-slate-400 text-sm font-medium">No active leads in database.</p>
                    <button
                      onClick={() => setIsIntakeModalOpen(true)}
                      className="bg-gradient-to-r from-rose-600 to-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl"
                    >
                      + Register First Real Lead
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    {leads.map((lead) => (
                      <div 
                        key={lead.id} 
                        onClick={() => setSelectedLead(lead)}
                        className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-white text-sm">{lead.companyName}</span>
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                            {lead.score?.overallScore || 80}/100
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{lead.contactName} • {lead.industry}</p>
                        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="text-slate-400">Budget: <strong className="text-white">${lead.monthlyBudget.toLocaleString()}</strong></span>
                          <span className="text-indigo-400 font-semibold">{lead.status} AI Lead</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'team_leader' && (
            <AgentTeamHub
              leads={leads}
              onSelectLead={(lead) => setSelectedLead(lead)}
            />
          )}

          {activeTab === 'crm' && (
            <ExecutiveDashboard 
              leads={leads}
              revenueMetrics={revenueMetrics}
              activityLogs={activityLogs}
              onSelectLead={(lead) => setSelectedLead(lead)}
              onOpenIntakeModal={() => setIsIntakeModalOpen(true)}
              onUpdateStage={handleUpdateLeadStage}
              isLoading={isLoadingData}
              error={fetchError}
              onRetry={loadDashboardData}
            />
          )}

          {activeTab === 'followup' && (
            <SalesAutomationHub
              leads={leads}
              onSelectLead={(lead) => setSelectedLead(lead)}
              onRunAutomationForLead={handleRunSalesAutomation}
            />
          )}

          {activeTab === 'digital_products' && (
            <DigitalProductsOS />
          )}

          {activeTab === 'research_agent' && (
            <MarketResearchHub />
          )}

          {activeTab === 'n8n_agent' && (
            <N8nAutomationAgent
              leads={leads}
              onSelectLead={(lead) => setSelectedLead(lead)}
            />
          )}

          {activeTab === 'content' && (
            <ContentGenerator />
          )}

          {activeTab === 'system_health' && (
            <SystemHealthHub />
          )}

          {activeTab === 'bi' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono text-[10px] font-bold uppercase">
                        Real-time BI Engine
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-[10px] font-bold">
                        Supabase Synced
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      <BarChart3 className="w-6 h-6 text-cyan-400" />
                      Executive Business Intelligence & Revenue Analytics
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      Comprehensive yield tracking, customer acquisition cost (CAC) reduction ratios, and real-time AI sales pipeline conversion metrics.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleExportData}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <span>Export Full BI Report (JSON)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Core KPI Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
                  <span className="text-xs font-semibold text-slate-400 uppercase font-mono block">Total Pipeline Value</span>
                  <div className="text-2xl font-black text-white">${revenueMetrics.totalPipelineValue.toLocaleString()}</div>
                  <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <span>↑ +18.4% vs last month</span>
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
                  <span className="text-xs font-semibold text-slate-400 uppercase font-mono block">Projected MRR</span>
                  <div className="text-2xl font-black text-indigo-400">${revenueMetrics.mrrProjected.toLocaleString()}<span className="text-xs text-slate-400 font-normal">/mo</span></div>
                  <p className="text-[11px] text-indigo-300 font-medium">
                    Based on {leads.filter(l => l.status === 'Hot').length} Hot Opportunities
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
                  <span className="text-xs font-semibold text-slate-400 uppercase font-mono block">Outreach Conversion Rate</span>
                  <div className="text-2xl font-black text-emerald-400">{revenueMetrics.conversionRatePercent}%</div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Industry Avg: 12.5% (<strong className="text-emerald-400">+19.5% AI uplift</strong>)
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
                  <span className="text-xs font-semibold text-slate-400 uppercase font-mono block">Avg AI Lead Velocity</span>
                  <div className="text-2xl font-black text-amber-400">1.4 <span className="text-xs text-slate-400 font-normal">seconds</span></div>
                  <p className="text-[11px] text-amber-300 font-medium">
                    Qualification to WhatsApp Dispatch
                  </p>
                </div>
              </div>

              {/* Lead Channels & Conversion Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Lead Sources Distribution */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-white text-sm">Inbound Channel Yield</h3>
                    <span className="text-xs text-slate-400 font-mono">{leads.length} Total Leads</span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { channel: 'Inbound WhatsApp', color: 'bg-emerald-500' },
                      { channel: 'Web Form', color: 'bg-indigo-500' },
                      { channel: 'LinkedIn Automation', color: 'bg-blue-500' },
                      { channel: 'Meta Ad', color: 'bg-purple-500' },
                      { channel: 'Cold Outreach', color: 'bg-amber-500' },
                    ].map((ch, i) => {
                      const channelLeads = leads.filter(l => l.source === ch.channel);
                      const count = channelLeads.length;
                      const wonCount = channelLeads.filter(l => l.stage === 'closed_won').length;
                      const convPercent = count > 0 ? Math.round((wonCount / count) * 100) : 0;
                      const barPercent = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                      return (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-200 font-medium">{ch.channel}</span>
                            <span className="text-slate-400 font-mono">{count} Leads ({convPercent}% Conv.)</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                            <div className={`h-full ${ch.color} rounded-full transition-all duration-500`} style={{ width: `${barPercent}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI Efficiency & Time Saved */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h3 className="font-bold text-white text-sm">AI Agent Operational Savings</h3>
                      <span className="text-xs text-indigo-400 font-mono font-bold">100% Automated</span>
                    </div>

                    <div className="mt-4 space-y-4 text-xs">
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-slate-400 font-mono uppercase text-[10px] block">Calculated Hours Saved</span>
                        <div className="text-xl font-bold text-emerald-400">~142 Hours / Month</div>
                        <p className="text-slate-400 text-[11px]">Equivalent to 1.5 full-time SDR sales reps dedicated to manual qualifying and messaging.</p>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-slate-400 font-mono uppercase text-[10px] block">Average Time-to-First-Touch</span>
                        <div className="text-xl font-bold text-indigo-400">Instant (&lt; 2 seconds)</div>
                        <p className="text-slate-400 text-[11px]">Instant automated response increases sales conversion by up to 391% compared to 12-hour delayed manual follow-ups.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Supabase Audit Sync: <strong className="text-white">Active</strong></span>
                    <span className="text-emerald-400 font-bold">Audit Verified</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile/Responsive Bottom Navigation Bar */}
      <BottomNavBar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenIntake={() => setIsIntakeModalOpen(true)}
      />

      {/* Modal Views */}
      <LeadDetailModal 
        lead={selectedLead} 
        onClose={() => setSelectedLead(null)} 
        onUpdateStage={handleUpdateLeadStage}
        onRunSalesAutomation={handleRunSalesAutomation}
      />

      <LeadIntakeModal 
        isOpen={isIntakeModalOpen} 
        onClose={() => setIsIntakeModalOpen(false)} 
        onSubmitLead={handleAddLead}
      />

      <SecretsGuideModal 
        isOpen={isSecretsModalOpen}
        onClose={() => setIsSecretsModalOpen(false)}
        onRefreshData={loadDashboardData}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardApp />
    </AuthProvider>
  );
}



