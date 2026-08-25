import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  UserCheck, 
  Kanban, 
  Workflow, 
  FileText, 
  BarChart3, 
  Zap, 
  Bot, 
  Database,
  ChevronRight,
  ShieldCheck,
  Building2,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed
}) => {
  const { user, signOut, isSupabaseConfigured } = useAuth();

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Executive Admin';
  const userEmail = user?.email || 'admin@zamedia.ai';

  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, badge: 'Live' },
    { id: 'team_leader', label: 'Multi-Agent Operations', icon: Bot, badge: 'AI COO' },
    { id: 'intake', label: 'Lead Intake & AI Scoring', icon: UserCheck, badge: 'AI Active' },
    { id: 'crm', label: 'CRM Pipeline Board', icon: Kanban },
    { id: 'followup', label: 'Follow-up Workflows', icon: Workflow, badge: 'n8n Ready' },
    { id: 'digital_products', label: 'Digital Products OS', icon: Zap, badge: 'Revenue' },
    { id: 'research_agent', label: 'Market Intelligence', icon: Building2, badge: 'Tavily AI' },
    { id: 'content', label: 'Content Operations', icon: FileText },
    { id: 'bi', label: 'Business Intelligence', icon: BarChart3 },
    { id: 'system_health', label: 'System Health & Observability', icon: ShieldCheck, badge: '100% OK' },
  ];

  return (
    <aside className={`bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col justify-between transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'} shrink-0 min-h-screen select-none`}>
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0 font-bold text-xl">
              ZA
            </div>
            {!collapsed && (
              <div className="truncate">
                <h1 className="font-extrabold text-base text-white tracking-tight leading-none">
                  ZA MEDIA
                </h1>
                <p className="text-xs text-indigo-400 font-medium mt-1 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400 fill-amber-400" /> AI Growth Engine
                </p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <ChevronRight className={`w-5 h-5 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* System Health Status */}
        {!collapsed && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/90 text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-2 font-medium">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                AI System Online
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">v1.0 Baseline</span>
            </div>
            <div className="space-y-1.5 text-slate-400">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-slate-300">
                  <Bot className="w-3 h-3 text-purple-400" /> Gemini Engine
                </span>
                <span className="text-emerald-400 font-medium">Active</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-slate-300">
                  <Zap className="w-3 h-3 text-amber-400" /> n8n Automation
                </span>
                <span className="text-blue-400 font-medium">Ready</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-slate-300">
                  <Database className="w-3 h-3 text-cyan-400" /> Supabase Storage
                </span>
                <span className={isSupabaseConfigured ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                  {isSupabaseConfigured ? "Connected" : "Local Mode"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="p-3 mt-3 space-y-1">
          <div className={`px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase ${collapsed ? 'hidden' : 'block'}`}>
            Core Operations
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/25 font-semibold' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {!collapsed && (
                  <div className="flex items-center justify-between w-full truncate">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {userName.substring(0, 2).toUpperCase()}
              </div>
              <div className="truncate text-xs">
                <p className="font-semibold text-slate-200 truncate flex items-center gap-1">
                  {userName} <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                </p>
                <p className="text-slate-400 text-[10px] truncate">{userEmail}</p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors shrink-0"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => signOut()}
              className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 hover:border-rose-600 flex items-center justify-center font-bold text-slate-300 hover:text-rose-400 transition-colors"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

