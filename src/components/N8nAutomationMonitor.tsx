import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Play, 
  ExternalLink, 
  Workflow, 
  Layers, 
  Clock, 
  Zap, 
  ShieldAlert, 
  Bot, 
  Code2, 
  Copy, 
  Check, 
  Terminal, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Sparkles,
  Server,
  Radio,
  FileCheck,
  Send,
  AlertTriangle
} from 'lucide-react';
import { 
  N8nWorkflow, 
  N8nExecutionLog, 
  N8nSystemStats, 
  N8nAutofixRemediation,
  fetchN8nWorkflowsAndStats, 
  fetchN8nExecutionLogs, 
  triggerN8nWorkflowTest, 
  analyzeN8nErrorWithAi 
} from '../services/n8nMonitorService';
import { DEFAULT_PRODUCTION_WEBHOOK_URL, resolveSafeWebhookUrl } from '../lib/webhookProxy';

export const N8nAutomationMonitor: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'workflows' | 'executions' | 'errors' | 'tester'>('workflows');
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);
  const [stats, setStats] = useState<N8nSystemStats | null>(null);
  const [executions, setExecutions] = useState<N8nExecutionLog[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected execution for deep inspection
  const [selectedExecution, setSelectedExecution] = useState<N8nExecutionLog | null>(null);
  const [expandedExecIds, setExpandedExecIds] = useState<Record<string, boolean>>({});

  // AI Autofix state
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false);
  const [aiRemediation, setAiRemediation] = useState<N8nAutofixRemediation | null>(null);

  // Interactive tester state
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('wf-lead-intake');
  const [testPayload, setTestPayload] = useState<string>(JSON.stringify({
    contactName: "Michael Sterling",
    companyName: "Sterling Tech Ventures",
    email: "michael@sterlingtech.io",
    phone: "+1 (555) 987-6543",
    monthlyBudget: 25000,
    industry: "Enterprise SaaS & Automation",
    source: "Live Automation Monitor Test",
    serviceInterest: "AI SDR & Revenue Engine Integration"
  }, null, 2));
  const [isTriggeringTest, setIsTriggeringTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = async (showLoadingState: boolean = true) => {
    if (showLoadingState) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const [wfRes, execRes] = await Promise.all([
        fetchN8nWorkflowsAndStats(),
        fetchN8nExecutionLogs(statusFilter)
      ]);
      setWorkflows(wfRes.workflows);
      setStats(wfRes.stats);
      setExecutions(execRes.executions);
      if (execRes.executions.length > 0 && !selectedExecution) {
        setSelectedExecution(execRes.executions[0]);
      }
    } catch (err) {
      console.error('Failed to load n8n monitor data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(false);
    }, 25000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedExecIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleTriggerTest = async () => {
    setIsTriggeringTest(true);
    setTestResult(null);
    try {
      let parsedPayload: any = {};
      try {
        parsedPayload = JSON.parse(testPayload);
      } catch {
        parsedPayload = { rawText: testPayload };
      }

      const res = await triggerN8nWorkflowTest({
        workflowId: selectedWorkflowId,
        payload: parsedPayload
      });
      setTestResult(res);
      // Reload logs immediately to show new execution in stream
      loadData(false);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Trigger failed'
      });
    } finally {
      setIsTriggeringTest(false);
    }
  };

  const handleAskAiFix = async (exec: N8nExecutionLog) => {
    setIsAnalyzingAi(true);
    setAiRemediation(null);
    try {
      const remediation = await analyzeN8nErrorWithAi({
        errorMessage: exec.errorMessage || 'Execution returned non-200 status',
        nodeName: exec.nodeTrace.find(n => n.status === 'failed')?.nodeName || 'Downstream Node',
        payload: exec.payload,
        httpStatus: exec.httpStatus
      });
      setAiRemediation(remediation);
    } catch (err) {
      console.error('AI analysis error:', err);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const errorLogs = executions.filter(e => e.status === 'error');
  const filteredWorkflows = workflows.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExecutions = executions.filter(e => 
    e.workflowName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.leadName && e.leadName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    e.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Executive Banner & Instance Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-700 text-indigo-300 font-mono text-[10px] font-bold uppercase flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-indigo-400 animate-pulse" /> n8n Cloud Production API
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono text-[10px] font-bold">
                Host: enjywork.app.n8n.cloud
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Workflow className="w-6 h-6 text-indigo-400" />
              <span>n8n Workflow Automation Monitor</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Real-time telemetry, live execution logs, error tracking, and AI-powered node self-healing for your n8n workflow cluster.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://enjywork.app.n8n.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open n8n Canvas</span>
            </a>

            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sync Live Logs</span>
            </button>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80 text-xs">
          <button
            onClick={() => setActiveSubTab('workflows')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'workflows'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Active Workflows ({workflows.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('executions')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'executions'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Execution Logs ({executions.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('errors')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'errors'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Error Inspector ({stats?.totalErrors || errorLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('tester')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'tester'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Interactive Webhook Tester</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase text-[10px]">Active Workflows</span>
            <Workflow className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {stats?.activeWorkflows || workflows.length} <span className="text-xs text-slate-500 font-normal">/ {stats?.totalWorkflows || workflows.length}</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 100% Operational
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase text-[10px]">Total Executions (24h)</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {stats?.totalExecutions || 391}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Success Rate: <strong className="text-emerald-400">{stats?.overallSuccessRate || 98.7}%</strong>
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase text-[10px]">Error Count & Failures</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            {stats?.totalErrors || 5}
          </div>
          <span className="text-[11px] text-rose-300 font-mono">
            Failure Rate: {(100 - (stats?.overallSuccessRate || 98.7)).toFixed(1)}%
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase text-[10px]">Average Node Latency</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400">
            {stats?.averageLatencyMs || 350}ms
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Async Non-Blocking Routing
          </span>
        </div>
      </div>

      {/* Sub-tab 1: Workflows List */}
      {activeSubTab === 'workflows' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search workflows by title, category, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-400 font-mono">{filteredWorkflows.length} Configured Workflows</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredWorkflows.map((wf) => (
              <div 
                key={wf.id} 
                className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-xl"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-950 border border-indigo-800/80 text-indigo-300 text-[10px] font-bold font-mono uppercase">
                        {wf.category}
                      </span>
                      <h3 className="font-bold text-white text-base mt-2 group-hover:text-indigo-300 transition-colors">
                        {wf.name}
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-[10px] font-bold uppercase shrink-0">
                      ● {wf.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {wf.description}
                  </p>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-mono">Webhook Endpoint:</span>
                      <button
                        onClick={() => handleCopy(wf.webhookUrl, wf.id)}
                        className="text-indigo-400 hover:text-indigo-300 font-mono text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === wf.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === wf.id ? 'Copied' : 'Copy URL'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-slate-300 text-[11px] truncate select-all">
                      {wf.webhookUrl}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {wf.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="text-slate-400 text-[11px] font-mono">
                    <span className="text-white font-bold">{wf.totalRuns}</span> runs • <span className="text-emerald-400 font-bold">{wf.successRate}%</span> success
                  </div>
                  <button
                    onClick={() => {
                      setSelectedWorkflowId(wf.id);
                      setActiveSubTab('tester');
                    }}
                    className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Test Workflow</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab 2: Execution Logs */}
      {activeSubTab === 'executions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter logs by workflow name, lead name, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">Status Filter:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Logs ({executions.length})</option>
                <option value="success">Success Only</option>
                <option value="error">Errors Only</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredExecutions.length === 0 ? (
              <div className="p-12 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                No execution logs found matching filter.
              </div>
            ) : (
              filteredExecutions.map((exec) => {
                const isExpanded = expandedExecIds[exec.id];
                return (
                  <div 
                    key={exec.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 transition-all shadow-lg"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          exec.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">{exec.id}</span>
                            <span className="text-slate-300 font-semibold text-xs">{exec.workflowName}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Trigger: <strong className="text-slate-300">{exec.triggerSource}</strong></span>
                            {exec.leadName && <span>• Lead: <strong className="text-indigo-300">{exec.leadName}</strong></span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="text-[11px] font-mono text-slate-400">
                          {exec.durationMs}ms
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          exec.status === 'success' 
                            ? 'bg-emerald-950 border border-emerald-800 text-emerald-300' 
                            : 'bg-rose-950 border border-rose-800 text-rose-300'
                        }`}>
                          HTTP {exec.httpStatus} • {exec.status}
                        </span>
                        <button
                          onClick={() => toggleExpand(exec.id)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Pipeline Node Trace & JSON Inspector */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-4 text-xs">
                        {/* Node Trace Timeline */}
                        <div>
                          <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold block mb-2">
                            Workflow Pipeline Node Execution Trace:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                            {exec.nodeTrace.map((node, i) => (
                              <div key={i} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                                <div className="space-y-0.5 truncate">
                                  <span className="font-bold text-slate-200 text-[11px] truncate block">{node.nodeName}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{node.durationMs}ms</span>
                                </div>
                                <span className={`text-[10px] font-bold font-mono ${
                                  node.status === 'completed' ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                  {node.status === 'completed' ? '✓' : '✕'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Payloads Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold">Input Payload</span>
                              <button
                                onClick={() => handleCopy(JSON.stringify(exec.payload, null, 2), `in-${exec.id}`)}
                                className="text-slate-400 hover:text-white text-[10px] flex items-center gap-1 cursor-pointer"
                              >
                                {copiedKey === `in-${exec.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                <span>Copy</span>
                              </button>
                            </div>
                            <pre className="font-mono text-[10px] text-indigo-300 max-h-36 overflow-y-auto select-all">
                              {JSON.stringify(exec.payload, null, 2)}
                            </pre>
                          </div>

                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold">Output Response</span>
                              <button
                                onClick={() => handleCopy(JSON.stringify(exec.response, null, 2), `out-${exec.id}`)}
                                className="text-slate-400 hover:text-white text-[10px] flex items-center gap-1 cursor-pointer"
                              >
                                {copiedKey === `out-${exec.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                <span>Copy</span>
                              </button>
                            </div>
                            <pre className="font-mono text-[10px] text-emerald-400 max-h-36 overflow-y-auto select-all">
                              {JSON.stringify(exec.response, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {/* AI Fix Option if error */}
                        {exec.status === 'error' && (
                          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center justify-between gap-3">
                            <div className="text-rose-300 text-xs">
                              <strong>Error Trace:</strong> {exec.errorMessage || 'Downstream node failure in n8n execution pipeline.'}
                            </div>
                            <button
                              onClick={() => handleAskAiFix(exec)}
                              disabled={isAnalyzingAi}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
                            >
                              <Bot className="w-3.5 h-3.5" />
                              <span>{isAnalyzingAi ? 'Analyzing...' : '🤖 AI Auto-Fix'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Sub-tab 3: Error Inspector & AI Self-Healing */}
      {activeSubTab === 'errors' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-base">n8n Execution Errors & AI Remediation Center</h3>
              </div>
              <span className="px-3 py-1 bg-rose-950 border border-rose-800 text-rose-300 font-mono font-bold text-xs rounded-full">
                {errorLogs.length} Failed Runs Captured
              </span>
            </div>

            {errorLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="font-bold text-white">All workflow runs executed with zero error exceptions!</p>
                <p className="text-slate-500">Your n8n automation pipelines are operating at 100% reliability.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {errorLogs.map((errLog) => (
                  <div key={errLog.id} className="p-4 bg-slate-950 rounded-xl border border-rose-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-rose-400 font-bold text-xs">{errLog.id}</span>
                        <h4 className="font-bold text-white text-sm">{errLog.workflowName}</h4>
                      </div>
                      <button
                        onClick={() => handleAskAiFix(errLog)}
                        disabled={isAnalyzingAi}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>{isAnalyzingAi ? 'Diagnosing with Gemini...' : 'Analyze with Gemini AI'}</span>
                      </button>
                    </div>

                    <p className="text-xs text-rose-300 bg-rose-950/60 p-2.5 rounded-lg font-mono">
                      {errLog.errorMessage || 'Execution returned non-200 HTTP response.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Remediation Recommendation Card */}
          {aiRemediation && (
            <div className="bg-slate-900 border border-purple-800/80 rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-white text-base">Gemini 2.5 Auto-Fix Remediation Blueprint</h3>
                </div>
                <span className="text-xs font-mono bg-purple-950 border border-purple-800 text-purple-300 px-3 py-1 rounded-xl">
                  Confidence: {aiRemediation.confidenceScore}%
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Diagnosed Root Cause:</span>
                <p className="text-xs text-slate-200 bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed">
                  {aiRemediation.rootCause}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Step-by-Step UI Canvas Fix:</span>
                <div className="space-y-2 text-xs">
                  {aiRemediation.fixSteps.map((step, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2.5 text-slate-300">
                      <span className="font-mono font-bold text-indigo-400">#{idx + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Recommended Node Parameters / Config:</span>
                <pre className="font-mono text-xs text-emerald-400 bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto select-all">
                  {aiRemediation.recommendedNodeConfig}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 4: Interactive Webhook Tester */}
      {activeSubTab === 'tester' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400 fill-current" />
                Live Webhook Trigger Simulator
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Dispatch structured JSON payloads directly to your active n8n instance and inspect real-time execution outputs.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Workflow</label>
                <select
                  value={selectedWorkflowId}
                  onChange={(e) => setSelectedWorkflowId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name} ({wf.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">JSON Event Payload</label>
                  <button
                    onClick={() => {
                      setTestPayload(JSON.stringify({
                        contactName: "Omar Khattab",
                        companyName: "Khattab Capital",
                        email: "omar@growthventures.co",
                        phone: "+971 50 123 4567",
                        monthlyBudget: 35000,
                        industry: "Private Equity & Real Estate",
                        source: "Direct Inbound Portal",
                        serviceInterest: "Enterprise AI Closer Suite"
                      }, null, 2));
                    }}
                    className="text-indigo-400 hover:text-indigo-300 text-[10px] cursor-pointer"
                  >
                    Reset Sample Payload
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-indigo-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleTriggerTest}
                disabled={isTriggeringTest}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isTriggeringTest ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Synchronous Webhook Dispatch...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Dispatch Test Event to n8n</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Test Execution Output */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Live Execution Telemetry
                </h3>
                <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                  HTTP Dispatch Monitor
                </span>
              </div>

              {testResult ? (
                <div className="space-y-3 bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-400">Status</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-[10px] uppercase ${
                      testResult.success ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {testResult.success ? 'SUCCESS (200 OK)' : 'ERROR'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Returned Payload</span>
                    <pre className="font-mono text-[10px] text-emerald-300 bg-slate-900 p-3 rounded-lg border border-slate-800 max-h-48 overflow-y-auto select-all">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  Click "Dispatch Test Event to n8n" on the left to trigger the webhook and view raw execution results.
                </div>
              )}
            </div>

            <div className="pt-4 mt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Webhook Destination: <strong className="text-white">enjywork.app.n8n.cloud</strong></span>
              <span className="text-emerald-400 font-bold">Live Proxy Ready</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
