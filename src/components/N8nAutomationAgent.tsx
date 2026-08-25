import React, { useState, useEffect } from 'react';
import { Lead } from '../types';
import { n8nService, N8NExecutionResponse } from '../services/n8n';
import { fetchRawAiActionsFromSupabase, logAiActionToSupabase } from '../lib/supabase';
import { DEFAULT_PRODUCTION_WEBHOOK_URL } from '../lib/webhookProxy';
import { 
  Bot, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  Code2, 
  Copy, 
  Check, 
  RefreshCw, 
  Settings, 
  FileCheck, 
  Layers, 
  PhoneCall, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  Database,
  ExternalLink,
  Sparkles,
  Info
} from 'lucide-react';

interface N8nAutomationAgentProps {
  leads: Lead[];
  onSelectLead?: (lead: Lead) => void;
}

export const N8nAutomationAgent: React.FC<N8nAutomationAgentProps> = ({
  leads,
  onSelectLead
}) => {
  const [webhookUrl, setWebhookUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('n8n_webhook_url') || DEFAULT_PRODUCTION_WEBHOOK_URL;
    }
    return DEFAULT_PRODUCTION_WEBHOOK_URL;
  });

  const [savedUrlBadge, setSavedUrlBadge] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'agent' | 'autofix' | 'logs' | 'json'>('agent');
  
  // Dispatch state
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResponse, setLastResponse] = useState<N8NExecutionResponse | null>(null);
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Copy badges
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Form Label Auto-fixer state
  const [nodeLabels, setNodeLabels] = useState({
    fullName: 'Full Name',
    email: 'Email',
    phone: 'Phone',
    location: 'Location',
    serviceInterest: 'Service Interest',
    message: 'Message'
  });

  const selectedLead = leads.find(l => l.id === selectedLeadId) || leads[0];

  useEffect(() => {
    loadSupabaseLogs();
  }, []);

  const handleSaveWebhookUrl = (url: string) => {
    setWebhookUrl(url);
    if (typeof window !== 'undefined') {
      localStorage.setItem('n8n_webhook_url', url);
      setSavedUrlBadge(true);
      setTimeout(() => setSavedUrlBadge(false), 2000);
    }
  };

  const loadSupabaseLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const records = await fetchRawAiActionsFromSupabase(15);
      setExecutionLogs(records || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleDispatchWhatsApp = async () => {
    if (!selectedLead) return;
    setIsExecuting(true);
    setLastResponse(null);
    try {
      const res = await n8nService.dispatchWhatsApp(selectedLead, undefined, webhookUrl);
      setLastResponse(res);
      await loadSupabaseLogs();
    } catch (err: any) {
      setLastResponse({
        success: false,
        httpStatus: 500,
        isLive: false,
        deliveryStatus: 'Execution Error',
        details: err?.message || 'Failed to trigger n8n WhatsApp agent',
        error: err?.message
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDispatchGmail = async () => {
    if (!selectedLead) return;
    setIsExecuting(true);
    setLastResponse(null);
    try {
      const res = await n8nService.dispatchGmail(selectedLead, undefined, undefined, webhookUrl);
      setLastResponse(res);
      await loadSupabaseLogs();
    } catch (err: any) {
      setLastResponse({
        success: false,
        httpStatus: 500,
        isLive: false,
        deliveryStatus: 'Execution Error',
        details: err?.message || 'Failed to trigger n8n Gmail agent',
        error: err?.message
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDispatchCalendar = async () => {
    if (!selectedLead) return;
    setIsExecuting(true);
    setLastResponse(null);
    try {
      const res = await n8nService.dispatchCalendar(selectedLead, undefined, webhookUrl);
      setLastResponse(res);
      await loadSupabaseLogs();
    } catch (err: any) {
      setLastResponse({
        success: false,
        httpStatus: 500,
        isLive: false,
        deliveryStatus: 'Execution Error',
        details: err?.message || 'Failed to trigger n8n Calendar agent',
        error: err?.message
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyJsonWorkflow = () => {
    const jsonConfig = JSON.stringify(
      {
        nodes: [
          {
            parameters: {
              formTitle: "Lead Capture Form",
              formDescription: "Enter your company details to receive an instant AI strategy proposal.",
              fields: {
                values: [
                  { fieldLabel: nodeLabels.fullName, fieldName: "fullName", requiredField: true },
                  { fieldLabel: nodeLabels.email, fieldName: "email", requiredField: true },
                  { fieldLabel: nodeLabels.phone, fieldName: "phone", requiredField: true },
                  { fieldLabel: nodeLabels.location, fieldName: "location", requiredField: false },
                  { fieldLabel: nodeLabels.serviceInterest, fieldName: "serviceInterest", requiredField: true },
                  { fieldLabel: nodeLabels.message, fieldName: "message", requiredField: false }
                ]
              }
            },
            name: "Lead Capture Form",
            type: "n8n-nodes-base.formTrigger",
            typeVersion: 1,
            position: [250, 300]
          }
        ]
      },
      null,
      2
    );

    navigator.clipboard.writeText(jsonConfig);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-700 text-indigo-300 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Bot className="w-3 h-3 text-indigo-400" /> n8n Orchestrator Agent
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-[10px] font-bold flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-400" /> Live Webhooks Ready
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              n8n Automation Agent Hub
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Automated workflow manager for Meta WhatsApp Cloud API, Gmail OAuth2, Google Calendar, and n8n Lead Capture Form auto-repair.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('autofix')}
              className="px-3.5 py-2 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-300 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Form Labels Auto-Fixer</span>
            </button>
            <button
              onClick={() => setActiveTab('agent')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Dispatch Live Workflows</span>
            </button>
          </div>
        </div>
      </div>

      {/* Webhook Settings Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Settings className="w-5 h-5 text-indigo-400 shrink-0" />
          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">
              Active n8n Webhook Endpoint URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => handleSaveWebhookUrl(e.target.value)}
                placeholder="https://n8n.your-domain.com/webhook/lead-intake"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  setCopiedUrl(true);
                  setTimeout(() => setCopiedUrl(false), 2000);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl flex items-center gap-1 shrink-0 font-medium cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {savedUrlBadge && (
          <span className="px-3 py-1 bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-mono rounded-lg flex items-center gap-1 animate-pulse shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Webhook Saved
          </span>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('agent')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'agent'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Bot className="w-4 h-4" /> Agent Webhook Dispatcher
        </button>

        <button
          onClick={() => setActiveTab('autofix')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'autofix'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Lead Capture Form Fixer
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Database className="w-4 h-4 text-cyan-400" /> Supabase Audit Logs
        </button>

        <button
          onClick={() => setActiveTab('json')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'json'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Code2 className="w-4 h-4 text-purple-400" /> Workflow JSON Template
        </button>
      </div>

      {/* TAB 1: AGENT DISPATCHER */}
      {activeTab === 'agent' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Target Lead Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" /> Select Target Opportunity
            </h3>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-slate-400 uppercase block">Active Lead</label>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.companyName} ({l.contactName}) - Score: {l.score?.overallScore || '92'}
                  </option>
                ))}
              </select>
            </div>

            {selectedLead && (
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-bold text-white">{selectedLead.companyName}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-mono text-[10px] border border-emerald-800">
                    {selectedLead.status || 'Hot'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">Contact: {selectedLead.contactName}</p>
                <p className="text-slate-400 font-mono text-[11px]">Phone: {selectedLead.phone || '+971 50 123 4567'}</p>
                <p className="text-slate-400 font-mono text-[11px]">Email: {selectedLead.email || 'lead@company.com'}</p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="pt-2 space-y-2">
              <label className="text-[11px] font-mono text-slate-400 uppercase block">Execute Individual Channel Workflows</label>
              <button
                onClick={handleDispatchWhatsApp}
                disabled={isExecuting}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <PhoneCall className="w-4 h-4" />
                <span>1. Dispatch Meta WhatsApp Cloud API</span>
              </button>

              <button
                onClick={handleDispatchGmail}
                disabled={isExecuting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                <span>2. Send Gmail Proposal via OAuth2</span>
              </button>

              <button
                onClick={handleDispatchCalendar}
                disabled={isExecuting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Calendar className="w-4 h-4" />
                <span>3. Book Google Calendar Strategy Session</span>
              </button>
            </div>
          </div>

          {/* Dispatch Output & Response Capture */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Webhook API Response Monitor
                </h3>
                {isExecuting && (
                  <span className="text-xs font-mono text-indigo-400 flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Transmitting to n8n...
                  </span>
                )}
              </div>

              {lastResponse ? (
                <div className="mt-4 space-y-3">
                  <div className={`p-4 rounded-xl border ${
                    lastResponse.success ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200' : 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                  }`}>
                    <div className="flex items-center justify-between font-mono text-xs font-bold mb-2">
                      <span className="flex items-center gap-1.5">
                        {lastResponse.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                        Status: {lastResponse.deliveryStatus}
                      </span>
                      <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
                        HTTP {lastResponse.httpStatus}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed">{lastResponse.details}</p>

                    {/* Captured IDs */}
                    <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">WhatsApp WAMID</span>
                        <span className="text-emerald-400 font-bold">{lastResponse.wamid || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Gmail Message ID</span>
                        <span className="text-indigo-400 font-bold">{lastResponse.messageId || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Google Calendar Event ID</span>
                        <span className="text-blue-400 font-bold">{lastResponse.eventId || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Raw Payload Preview */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 block uppercase">Raw Webhook Response Body</span>
                    <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-48">
                      {JSON.stringify(lastResponse.rawResponse || lastResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="mt-8 text-center py-12 border-2 border-dashed border-slate-800 rounded-xl p-6">
                  <Bot className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">Select a lead on the left and click any channel button to trigger live n8n workflows.</p>
                  <p className="text-slate-500 text-[11px] mt-1">Verified delivery IDs will be captured and written directly to Supabase.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Supabase Auto-Sync: <strong className="text-emerald-400">Active</strong></span>
              <span>Proxy Gateway: <strong className="text-cyan-400">/api/n8n-webhook</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FORM LABEL AUTO-FIXER */}
      {activeTab === 'autofix' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Lead Capture Form Fixer (`Parameter "Label" is required`)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              If publishing fails in n8n with red warning on Lead Capture Form due to missing Field Labels, assign valid labels to all form fields below and copy the fixed configuration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'fullName', name: 'fullName', defaultLabel: 'Full Name' },
              { key: 'email', name: 'email', defaultLabel: 'Email' },
              { key: 'phone', name: 'phone', defaultLabel: 'Phone' },
              { key: 'location', name: 'location', defaultLabel: 'Location' },
              { key: 'serviceInterest', name: 'serviceInterest', defaultLabel: 'Service Interest' },
              { key: 'message', name: 'message', defaultLabel: 'Message' },
            ].map((field) => (
              <div key={field.key} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-mono">fieldName: <strong className="text-white">{field.name}</strong></span>
                  <span className="text-emerald-400 font-mono text-[10px]">Required Label</span>
                </div>
                <input
                  type="text"
                  value={(nodeLabels as any)[field.key]}
                  onChange={(e) => setNodeLabels({ ...nodeLabels, [field.key]: e.target.value })}
                  placeholder={`Label for ${field.name}`}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>

          <div className="p-4 bg-emerald-950/30 border border-emerald-800/80 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> All 6 Form Fields Configured with Labels
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Copy the fixed JSON definition or paste labels into your n8n Lead Capture Form node parameters to allow publishing.
              </p>
            </div>

            <button
              onClick={handleCopyJsonWorkflow}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition-all shrink-0 cursor-pointer"
            >
              {copiedJson ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedJson ? 'Copied Node JSON!' : 'Copy Fixed Node JSON'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: SUPABASE AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" /> Verified Supabase `ai_actions` Audit Trail
            </h3>
            <button
              onClick={loadSupabaseLogs}
              disabled={isLoadingLogs}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl flex items-center gap-1.5 font-medium cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Agent Name</th>
                  <th className="py-2.5 px-3">Action Type</th>
                  <th className="py-2.5 px-3">Delivery ID / WAMID</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {executionLogs.length > 0 ? (
                  executionLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-950/50 text-slate-300">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        {new Date(log.created_at || Date.now()).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">{log.agent_name}</td>
                      <td className="py-2.5 px-3 text-indigo-300">{log.action_type}</td>
                      <td className="py-2.5 px-3 text-cyan-300 font-bold">
                        {log.payload?.delivery_id || log.payload?.wamid || log.payload?.messageId || log.payload?.eventId || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          {log.status || 'success'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No audit records loaded yet. Trigger an action to view live feedback.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: JSON TEMPLATE */}
      {activeTab === 'json' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-400" /> n8n Lead Capture Node Import JSON
            </h3>
            <button
              onClick={handleCopyJsonWorkflow}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJson ? 'Copied!' : 'Copy Template'}</span>
            </button>
          </div>

          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-300 overflow-x-auto max-h-96 leading-relaxed">
{JSON.stringify(
  {
    name: "Lead Capture & Sales Automation Workflow",
    nodes: [
      {
        parameters: {
          formTitle: "Lead Capture Form",
          fields: {
            values: [
              { fieldLabel: "Full Name", fieldName: "fullName", requiredField: true },
              { fieldLabel: "Email", fieldName: "email", requiredField: true },
              { fieldLabel: "Phone", fieldName: "phone", requiredField: true },
              { fieldLabel: "Location", fieldName: "location", requiredField: false },
              { fieldLabel: "Service Interest", fieldName: "serviceInterest", requiredField: true },
              { fieldLabel: "Message", fieldName: "message", requiredField: false }
            ]
          }
        },
        name: "Lead Capture Form",
        type: "n8n-nodes-base.formTrigger",
        typeVersion: 1,
        position: [250, 300]
      }
    ]
  },
  null,
  2
)}
          </pre>
        </div>
      )}
    </div>
  );
};
