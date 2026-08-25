import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Bell, 
  Plus, 
  Sparkles, 
  Trash2,
  Database,
  Workflow,
  RefreshCw,
  Download,
  LogOut,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';

interface HeaderProps {
  onOpenIntakeModal: () => void;
  leadCount: number;
  hotLeadCount: number;
  onClearDemoData: () => void;
  onRestoreDemoData?: () => void;
  onExportData: () => void;
  isSupabaseConnected?: boolean;
  onOpenSecretsGuide?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenIntakeModal,
  leadCount,
  hotLeadCount,
  onClearDemoData,
  onRestoreDemoData,
  onExportData,
  isSupabaseConnected = false,
  onOpenSecretsGuide
}) => {
  const { user, signOut } = useAuth();
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Connection health states
  const [n8nStatus, setN8nStatus] = useState<'connected' | 'checking' | 'error'>('checking');
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'checking' | 'error'>('checking');

  useEffect(() => {
    let isMounted = true;

    async function checkServiceHealth() {
      // 1. Supabase connection check
      if (isSupabaseConnected) {
        if (isMounted) setSupabaseStatus('connected');
      } else {
        if (isMounted) setSupabaseStatus('error');
      }

      // 2. n8n service health check endpoint query
      try {
        const res = await fetch('/api/health');
        if (res.ok && isMounted) {
          setN8nStatus('connected');
        } else if (isMounted) {
          setN8nStatus('error');
        }
      } catch {
        if (isMounted) setN8nStatus('error');
      }
    }

    checkServiceHealth();
    const interval = setInterval(checkServiceHealth, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isSupabaseConnected]);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Executive User';
  const userEmail = user?.email || 'admin@zamedia.ai';

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between text-slate-100">
      {/* Title & Quick Status */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Executive Growth Engine
            <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              AI Operating System
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time Inbound Intake, AI Qualification, and Revenue Intelligence
          </p>
        </div>
      </div>

      {/* Center Search / Indicators */}
      <div className="hidden md:flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-slate-400">
        <Search className="w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search leads, companies, AI scores or workflows..." 
          className="bg-transparent text-slate-200 placeholder-slate-500 text-xs focus:outline-none w-64"
        />
        <kbd className="hidden lg:inline-block bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-mono">⌘K</kbd>
      </div>

      {/* Right Controls & Action Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Supabase Connection Status Indicator */}
        {supabaseStatus === 'connected' ? (
          <div 
            className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/50 px-3 py-1.5 rounded-xl text-xs shadow-sm"
            title="Supabase real-time database connection active"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-300 font-bold flex items-center gap-1.5 text-[11px] sm:text-xs">
              <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Supabase</span>
              <span className="text-[10px] sm:text-xs">Connected</span>
            </span>
          </div>
        ) : (
          <button 
            onClick={onOpenSecretsGuide}
            className="flex items-center gap-2 bg-amber-950/90 hover:bg-amber-900/90 border border-amber-500/60 px-3 py-1.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer group"
            title="Click to configure Supabase URL & Anon Key"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse relative inline-flex rounded-full h-2 w-2 bg-amber-500 group-hover:bg-amber-400"></span>
            </span>
            <span className="text-amber-300 font-bold flex items-center gap-1.5 text-[11px] sm:text-xs">
              <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Supabase</span>
              <span className="text-[10px] sm:text-xs">Offline</span>
            </span>
          </button>
        )}

        {/* n8n Automation Engine Connection Status Indicator */}
        {n8nStatus === 'connected' ? (
          <div 
            className="flex items-center gap-2 bg-indigo-950/80 border border-indigo-500/50 px-3 py-1.5 rounded-xl text-xs shadow-sm"
            title="n8n Orchestration Webhook Engine connected and active"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-indigo-300 font-bold flex items-center gap-1.5 text-[11px] sm:text-xs">
              <Workflow className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">n8n Engine</span>
              <span className="text-[10px] sm:text-xs">Active</span>
            </span>
          </div>
        ) : (
          <div 
            className="flex items-center gap-2 bg-rose-950/80 border border-rose-500/50 px-3 py-1.5 rounded-xl text-xs shadow-sm"
            title="n8n Engine checking health status"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span className="text-rose-300 font-bold flex items-center gap-1.5 text-[11px] sm:text-xs">
              <Workflow className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="hidden sm:inline">n8n Engine</span>
              <span className="text-[10px] sm:text-xs">Connecting</span>
            </span>
          </div>
        )}

        {/* Hot Leads Counter Indicator */}
        <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span className="text-amber-300 font-semibold">{hotLeadCount} Hot AI Scored Leads</span>
        </div>

        {/* Data Options Dropdown (Clear Demo Data / Start Fresh) */}
        <div className="relative">
          <button 
            onClick={() => setShowDataMenu(!showDataMenu)}
            className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-colors"
            title="Database & Demo Data Settings"
          >
            <Database className="w-4 h-4 text-indigo-400" />
            <span className="hidden lg:inline">Data Mode</span>
          </button>

          {showDataMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl z-50 p-2 text-xs space-y-1">
              <div className="px-3 py-1.5 font-bold text-slate-400 uppercase text-[10px] border-b border-slate-800/80 mb-1">
                Data Management
              </div>

              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear all leads in Supabase database?')) {
                    onClearDemoData();
                    setShowDataMenu(false);
                  }
                }}
                className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-950/40 rounded-xl flex items-center gap-2 transition-colors font-bold"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Database Leads</span>
              </button>

              <button
                onClick={() => {
                  if (onRestoreDemoData) {
                    onRestoreDemoData();
                  } else {
                    window.location.reload();
                  }
                  setShowDataMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-900 rounded-xl flex items-center gap-2 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                <span>Refresh Live Database</span>
              </button>

              <button
                onClick={() => {
                  onExportData();
                  setShowDataMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-900 rounded-xl flex items-center gap-2 transition-colors font-medium"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export Leads (JSON)</span>
              </button>
            </div>
          )}
        </div>

        {/* Action Button: Add Inbound Lead */}
        <button
          onClick={onOpenIntakeModal}
          className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all duration-150 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Real Lead</span>
        </button>

        {/* User Profile & Logout Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-colors text-xs"
            title="User Settings"
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <span className="hidden sm:inline font-semibold text-slate-200 truncate max-w-[100px]">
              {userName}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-60 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl z-50 p-3 text-xs space-y-2">
              <div className="pb-2 border-b border-slate-800">
                <p className="font-bold text-white text-xs truncate">{userName}</p>
                <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3 h-3" /> Authenticated Executive
                </div>
              </div>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  signOut();
                }}
                className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-950/40 rounded-xl flex items-center gap-2 transition-colors font-bold"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <button className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl relative transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-slate-900"></span>
        </button>
      </div>
    </header>
  );
};


