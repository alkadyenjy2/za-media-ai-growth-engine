import React, { useState } from 'react';
import { 
  Crown, 
  Users, 
  Play, 
  CheckCircle2, 
  Activity, 
  Zap, 
  Layers, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { 
  SpecializedAgent, 
  INITIAL_AGENTS, 
  runFullAutonomousGrowthCycle, 
  TeamCycleReport 
} from '../services/agentTeam';
import { Lead } from '../types';

interface AgentTeamHubProps {
  leads: Lead[];
  onSelectLead?: (lead: Lead) => void;
}

export const AgentTeamHub: React.FC<AgentTeamHubProps> = ({ leads }) => {
  const [agents] = useState<SpecializedAgent[]>(INITIAL_AGENTS);
  const [isRunningCycle, setIsRunningCycle] = useState<boolean>(false);
  const [latestReport, setLatestReport] = useState<TeamCycleReport | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<SpecializedAgent | null>(agents[0]);

  const handleRunTeamCycle = async () => {
    setIsRunningCycle(true);
    try {
      const report = await runFullAutonomousGrowthCycle(leads);
      setLatestReport(report);
    } finally {
      setIsRunningCycle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Leader (AI COO) Executive Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/60 to-slate-900 border border-purple-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-700 text-purple-300 font-mono text-[10px] font-bold uppercase flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" /> AI Executive COO
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-[10px] font-bold">
                5 Sub-Agents Active
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Multi-Agent Operations & Growth Orchestrator</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Hierarchical autonomous multi-agent architecture. The Team Leader (AI COO) manages objective routing, delegates to 5 specialized sub-agents, and enforces quality across intake, sales, research, digital fulfillment, and content.
            </p>
          </div>

          <button
            onClick={handleRunTeamCycle}
            disabled={isRunningCycle}
            className="px-5 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shrink-0 cursor-pointer"
          >
            {isRunningCycle ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Team Orchestration Cycle...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Run Autonomous Growth Cycle</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Autonomous Cycle Result Output (if executed) */}
      {latestReport && (
        <div className="bg-slate-900 border border-purple-800/60 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-white text-sm">Autonomous Team Execution Report</h3>
            </div>
            <span className="text-[10px] font-mono bg-emerald-950 border border-emerald-800 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
              ✓ CYCLE STATUS: {latestReport.status}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
            <strong>COO Evaluation:</strong> {latestReport.cooDecision}
          </p>

          <div className="space-y-2">
            <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">Delegated Action Trail:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {latestReport.actionsExecuted.map((act, i) => (
                <div key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="font-bold text-indigo-300 text-[11px] block">{act.agentName}</span>
                  <p className="text-slate-300 text-[11px]">{act.actionText}</p>
                  <span className="text-emerald-400 font-mono text-[10px] block">➔ {act.result}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5 Specialized Sub-Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const isSelected = selectedAgent?.id === agent.id;
          return (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`bg-slate-900 border rounded-2xl p-5 transition-all cursor-pointer shadow-lg flex flex-col justify-between ${
                isSelected 
                  ? 'border-purple-500 ring-1 ring-purple-500/50 bg-slate-900/90' 
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{agent.avatarIcon}</span>
                    <div>
                      <h4 className="font-bold text-white text-sm">{agent.title}</h4>
                      <span className="text-[10px] font-mono text-indigo-400">{agent.codeName}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-bold rounded-full">
                    {agent.status.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {agent.role}
                </p>

                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/60 text-[11px]">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Recent Action</span>
                  <p className="text-slate-300 line-clamp-2 mt-0.5">{agent.lastAction}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono">{agent.tasksCompleted} Tasks Handled</span>
                <span className="text-purple-400 font-bold">{agent.efficiencyScore}% Efficiency</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Agent Deep Dive & Capabilities */}
      {selectedAgent && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedAgent.avatarIcon}</span>
              <div>
                <h3 className="font-bold text-white text-base">{selectedAgent.title} - Operational Profile</h3>
                <p className="text-xs text-slate-400 font-mono">{selectedAgent.codeName} • Supervised by AI COO</p>
              </div>
            </div>
            <span className="text-xs font-mono bg-indigo-950 border border-indigo-800 text-indigo-300 px-3 py-1 rounded-xl">
              Efficiency: {selectedAgent.efficiencyScore}%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <span className="font-bold text-slate-300 uppercase font-mono text-[10px] block">Agent Core Capabilities</span>
              <ul className="space-y-1.5">
                {selectedAgent.capabilities.map((cap, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 flex flex-col justify-between">
              <div>
                <span className="font-bold text-slate-300 uppercase font-mono text-[10px] block">Delegation & Routing Policy</span>
                <p className="text-slate-400 text-[11px] leading-relaxed mt-1">
                  This agent operates deterministically under the AI COO. Inbound events automatically trigger sub-second scoring, proposal generation, and audit logging to Supabase.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
                <span>Autonomous Fallback: <strong className="text-emerald-400">Enabled</strong></span>
                <span className="text-indigo-400 font-bold">Zero-touch SLA &lt; 2s</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
