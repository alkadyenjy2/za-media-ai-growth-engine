import React, { useState, useMemo } from 'react';
import { Lead, RevenueMetrics, ActivityLog, StoryItem, PipelineStage } from '../types';
import { StoriesBar } from './StoriesBar';
import { MorningBriefCard } from './MorningBriefCard';
import { SocialLeadCard } from './SocialLeadCard';
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Zap, 
  Sparkles, 
  Bot, 
  ArrowUpRight, 
  Calendar, 
  Activity, 
  CheckCircle2, 
  Search,
  LayoutGrid,
  ListFilter,
  Flame,
  Plus,
  AlertCircle,
  RefreshCw,
  Inbox
} from 'lucide-react';

interface ExecutiveDashboardProps {
  leads: Lead[];
  revenueMetrics: RevenueMetrics;
  activityLogs: ActivityLog[];
  onSelectLead: (lead: Lead) => void;
  onOpenIntakeModal: () => void;
  onUpdateStage?: (leadId: string, stage: PipelineStage) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  leads,
  revenueMetrics,
  activityLogs,
  onSelectLead,
  onOpenIntakeModal,
  onUpdateStage = () => {},
  isLoading = false,
  error = null,
  onRetry
}) => {
  const [viewMode, setViewMode] = useState<'social_feed' | 'kanban'>('social_feed');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Calculate breakdown metrics
  const hotLeads = leads.filter(l => l.status === 'Hot');
  const warmLeads = leads.filter(l => l.status === 'Warm');
  const coldLeads = leads.filter(l => l.status === 'Cold');

  // Generate dynamic stories from live Supabase dataset
  const stories: StoryItem[] = useMemo(() => {
    const items: StoryItem[] = [];

    if (hotLeads.length > 0) {
      const topHot = hotLeads[0];
      items.push({
        id: `story-hot-${topHot.id}`,
        title: topHot.companyName,
        subtitle: `${hotLeads.length} Hot ${hotLeads.length === 1 ? 'Lead' : 'Leads'} 🔥`,
        category: 'hot_lead',
        badge: `${topHot.score?.overallScore || 85} Score`,
        avatarUrl: topHot.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        isUnread: true,
        content: {
          headline: `${topHot.companyName} qualified as $${topHot.estimatedValue.toLocaleString()} High Priority Opportunity`,
          details: [
            `Contact: ${topHot.contactName} (${topHot.email})`,
            `Industry: ${topHot.industry}`,
            `Monthly Budget: $${topHot.monthlyBudget.toLocaleString()}/mo`
          ],
          actionText: 'Dispatch WhatsApp Follow-up Link',
          metrics: `$${topHot.estimatedValue.toLocaleString()} Value`
        }
      });
    }

    if (leads.length > 0) {
      items.push({
        id: 'story-pipeline',
        title: 'Active Pipeline',
        subtitle: `${leads.length} Live Leads`,
        category: 'ai_insight',
        badge: 'Supabase DB',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        isUnread: false,
        content: {
          headline: `Live Supabase Database Pipeline Summary`,
          details: [
            `Total Pipeline Value: $${revenueMetrics.totalPipelineValue.toLocaleString()}`,
            `Projected MRR: $${revenueMetrics.mrrProjected.toLocaleString()}/mo`,
            `Qualified Active Deals: ${leads.filter(l => l.stage !== 'intake').length}`
          ],
          actionText: 'Review Pipeline Stages',
          metrics: `$${revenueMetrics.totalPipelineValue.toLocaleString()}`
        }
      });
    }

    const closedWonLeads = leads.filter(l => l.stage === 'closed_won');
    if (closedWonLeads.length > 0) {
      const topWon = closedWonLeads[0];
      items.push({
        id: `story-won-${topWon.id}`,
        title: 'Closed Deal',
        subtitle: `+$${topWon.estimatedValue.toLocaleString()}`,
        category: 'revenue',
        badge: 'Closed Won',
        avatarUrl: topWon.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        isUnread: true,
        content: {
          headline: `${topWon.companyName} Closed Won Deal 🎉`,
          details: [
            `Contract Value: $${topWon.estimatedValue.toLocaleString()}`,
            `Monthly Budget: $${topWon.monthlyBudget.toLocaleString()}/mo`,
            `Status: Active Client in Supabase`
          ],
          actionText: 'View Contract Details',
          metrics: `$${topWon.estimatedValue.toLocaleString()} Won`
        }
      });
    }

    if (activityLogs.length > 0) {
      const topActivity = activityLogs[0];
      items.push({
        id: `story-act-${topActivity.id}`,
        title: 'Latest Action',
        subtitle: topActivity.timestamp,
        category: 'followup',
        badge: 'Live Log',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        isUnread: false,
        content: {
          headline: topActivity.title,
          details: [
            topActivity.description,
            `Target: ${topActivity.leadName}`,
            `Logged at ${topActivity.timestamp}`
          ],
          actionText: 'Check Activity Stream',
          metrics: 'Recorded'
        }
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'story-empty',
        title: 'Baseline Ready',
        subtitle: 'Supabase Active',
        category: 'ai_insight',
        badge: 'Ready',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        isUnread: false,
        content: {
          headline: 'Supabase Database Ready for Inbound Leads',
          details: [
            'No demo data active. Database pipeline is live & synchronized.',
            'Submit a lead via intake modal to trigger Gemini AI qualification.',
            'AI actions will be logged in realtime to Supabase.'
          ],
          actionText: 'Add First Lead Now',
          metrics: 'Ready'
        }
      });
    }

    return items;
  }, [leads, hotLeads, revenueMetrics, activityLogs]);

  const filteredLeads = leads.filter(lead => {
    const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
    const matchesSearch = 
      lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.industry.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStage && matchesSearch;
  });

  const pipelineStages = [
    { id: 'intake', label: '1. Intake Queue', color: 'border-blue-500/40 bg-blue-950/20 text-blue-400' },
    { id: 'qualified', label: '2. AI Qualified', color: 'border-indigo-500/40 bg-indigo-950/20 text-indigo-400' },
    { id: 'discovery', label: '3. Discovery Call', color: 'border-purple-500/40 bg-purple-950/20 text-purple-400' },
    { id: 'proposal', label: '4. Proposal Sent', color: 'border-amber-500/40 bg-amber-950/20 text-amber-400' },
    { id: 'closed_won', label: '5. Closed Won', color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400' },
  ];

  const getStageTotalValue = (stageId: string) => {
    return leads
      .filter(l => l.stage === stageId)
      .reduce((sum, l) => sum + l.estimatedValue, 0);
  };

  const handleStoryAction = (actionText: string) => {
    // Story action handler
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl flex items-center justify-between text-rose-200 text-xs shadow-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-bold text-white">Database Fetch Error</p>
              <p className="text-rose-300/80 text-[11px]">{error}</p>
            </div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 bg-rose-900 hover:bg-rose-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* 1. Instagram-Style Stories Bar */}
      <StoriesBar stories={stories} onActionExecute={handleStoryAction} />

      {/* 2. Morning Briefing AI OS Header */}
      <MorningBriefCard 
        hotLeadCount={hotLeads.length}
        pipelineValue={revenueMetrics.totalPipelineValue}
        totalLeadsCount={leads.length}
        activityCount={activityLogs.length}
        onOpenIntake={onOpenIntakeModal}
      />

      {/* View Switcher Bar (Social AI Feed vs Pipeline Board) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('social_feed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              viewMode === 'social_feed'
                ? 'bg-gradient-to-r from-rose-600 to-indigo-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>AI Command Feed (Instagram Style)</span>
          </button>

          <button
            onClick={() => setViewMode('kanban')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              viewMode === 'kanban'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Pipeline Board</span>
          </button>
        </div>

        {/* Search & Stage Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Stages</option>
            <option value="intake">Intake Queue</option>
            <option value="qualified">AI Qualified</option>
            <option value="discovery">Discovery Call</option>
            <option value="proposal">Proposal Sent</option>
            <option value="closed_won">Closed Won</option>
          </select>
        </div>
      </div>

      {/* LOADING SKELETONS */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900 border border-slate-800/80 rounded-3xl p-6 space-y-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-800/60 rounded w-1/4"></div>
                  </div>
                </div>
                <div className="h-16 bg-slate-800/40 rounded-2xl"></div>
                <div className="flex justify-between items-center pt-2">
                  <div className="h-4 bg-slate-800 rounded w-1/5"></div>
                  <div className="h-4 bg-slate-800 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/2"></div>
              <div className="space-y-3">
                <div className="h-12 bg-slate-800/60 rounded-2xl"></div>
                <div className="h-12 bg-slate-800/60 rounded-2xl"></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* VIEW 1: SOCIAL AI COMMAND FEED (Instagram Post Style) */}
          {viewMode === 'social_feed' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Feed Column */}
              <div className="lg:col-span-2 space-y-4">
                {filteredLeads.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-12 text-center text-slate-400 text-xs space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto text-slate-400">
                      <Inbox className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">No Leads Found</h4>
                      <p className="text-slate-400 text-xs mt-1">
                        {leads.length === 0 
                          ? "No leads in Supabase database yet. Register your first lead to start AI qualification."
                          : "No leads match your search/filter criteria."}
                      </p>
                    </div>
                    {leads.length === 0 && (
                      <button
                        onClick={onOpenIntakeModal}
                        className="mt-2 inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add First Real Lead</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredLeads.map((lead) => (
                    <SocialLeadCard
                      key={lead.id}
                      lead={lead}
                      onSelectLead={onSelectLead}
                      onUpdateStage={onUpdateStage}
                    />
                  ))
                )}
              </div>

              {/* Right Sidebar: Real-time Stats & Activity */}
              <div className="space-y-6">
                {/* KPI Summary Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
                    Growth Revenue Pulse
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                      <span className="text-xs text-slate-400 font-medium">Pipeline Value</span>
                      <span className="text-base font-black text-white">${revenueMetrics.totalPipelineValue.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                      <span className="text-xs text-slate-400 font-medium">Closed Revenue MTD</span>
                      <span className="text-base font-black text-emerald-400">${revenueMetrics.closedRevenueMtd.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                      <span className="text-xs text-slate-400 font-medium">AI Qualification Velocity</span>
                      <span className="text-base font-black text-amber-300">{revenueMetrics.avgQualificationSpeedSec}s</span>
                    </div>
                  </div>
                </div>

                {/* Live Activity Stream */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      Live AI Activity
                    </h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>

                  <div className="space-y-3">
                    {activityLogs.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No recent database activities logged.</p>
                    ) : (
                      activityLogs.slice(0, 4).map((log) => (
                        <div key={log.id} className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-2xl text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{log.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{log.timestamp}</span>
                          </div>
                          <p className="text-slate-400 text-[11px]">{log.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: KANBAN PIPELINE BOARD */}
          {viewMode === 'kanban' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-2">
                {pipelineStages.map((stage) => {
                  const stageLeads = filteredLeads.filter(l => l.stage === stage.id);
                  const totalVal = getStageTotalValue(stage.id);

                  return (
                    <div key={stage.id} className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 flex flex-col justify-between min-w-[210px]">
                      <div>
                        <div className={`p-2.5 rounded-xl border text-xs font-bold mb-3 flex items-center justify-between ${stage.color}`}>
                          <span className="truncate">{stage.label}</span>
                          <span className="bg-slate-900 px-2 py-0.5 rounded-lg text-[10px] font-mono border border-slate-700">
                            {stageLeads.length}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 mb-3 px-1 flex justify-between font-mono">
                          <span>Value:</span>
                          <strong className="text-emerald-400">${totalVal.toLocaleString()}</strong>
                        </div>

                        <div className="space-y-3">
                          {stageLeads.length === 0 ? (
                            <div className="p-4 border border-dashed border-slate-800 rounded-xl text-center text-slate-600 text-xs">
                              No leads in stage
                            </div>
                          ) : (
                            stageLeads.map((lead) => (
                              <div
                                key={lead.id}
                                onClick={() => onSelectLead(lead)}
                                className="bg-slate-900 border border-slate-800 hover:border-indigo-500/60 rounded-2xl p-3.5 shadow-md hover:shadow-indigo-500/10 transition-all cursor-pointer group"
                              >
                                <div className="flex items-start justify-between gap-1 mb-1.5">
                                  <h5 className="font-bold text-xs text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                                    {lead.companyName}
                                  </h5>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-emerald-950 text-emerald-400 border-emerald-800">
                                    {lead.score.overallScore}
                                  </span>
                                </div>

                                <p className="text-[11px] text-slate-400 truncate mb-2">{lead.contactName}</p>

                                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
                                  <span className="font-bold text-emerald-400">${lead.estimatedValue.toLocaleString()}</span>
                                  <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                    {lead.source}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

