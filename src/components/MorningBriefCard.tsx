import React, { useState } from 'react';
import { Sparkles, Flame, DollarSign, Edit3, Zap, Bot, RefreshCw, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MorningBriefCardProps {
  hotLeadCount: number;
  pipelineValue: number;
  totalLeadsCount?: number;
  activityCount?: number;
  onOpenIntake: () => void;
  onAskAiClick?: () => void;
}

export const MorningBriefCard: React.FC<MorningBriefCardProps> = ({
  hotLeadCount,
  pipelineValue,
  totalLeadsCount = 0,
  activityCount = 0,
  onOpenIntake,
  onAskAiClick
}) => {
  const [aiAssistantQuery, setAiAssistantQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const handleAskAi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiAssistantQuery.trim()) return;

    setIsAiThinking(true);
    setAiResponse(null);

    setTimeout(() => {
      setIsAiThinking(false);
      setAiResponse(
        `AI Operating System analyzed current growth status: High lead velocity detected in UAE & KSA logistics accounts. Recommend dispatching targeted WhatsApp follow-ups to Tariq Al-Mansoor ($45k) and Faisal Mahmoud ($60k).`
      );
    }, 1200);
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-2xl mb-8">
      {/* Background ambient light */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Side: Greeting & Status Chips */}
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-rose-500 rounded-2xl shadow-md text-white">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Good morning, Enjy 🌸
                </h1>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wide">
                  ZA AI OS Active
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Your AI Growth Assistant is running active pipeline automation across all channels.
              </p>
            </div>
          </div>

          {/* Quick Metrics Chips Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="bg-slate-950/80 border border-rose-500/30 rounded-2xl p-3 flex items-center gap-3 shadow-inner hover:border-rose-500/60 transition-colors">
              <div className="p-2 bg-rose-950/80 rounded-xl text-rose-400">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-sm font-black text-white">{hotLeadCount} Hot Leads</span>
                <span className="text-[10px] text-slate-400">Need Attention</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-3 flex items-center gap-3 shadow-inner hover:border-emerald-500/60 transition-colors">
              <div className="p-2 bg-emerald-950/80 rounded-xl text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-sm font-black text-white">${(pipelineValue / 1000).toFixed(0)}k Pipeline</span>
                <span className="text-[10px] text-slate-400">Waiting Stage</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-purple-500/30 rounded-2xl p-3 flex items-center gap-3 shadow-inner hover:border-purple-500/60 transition-colors">
              <div className="p-2 bg-purple-950/80 rounded-xl text-purple-400">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-sm font-black text-white">{totalLeadsCount} Total Leads</span>
                <span className="text-[10px] text-slate-400">In Database</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-3 flex items-center gap-3 shadow-inner hover:border-indigo-500/60 transition-colors">
              <div className="p-2 bg-indigo-950/80 rounded-xl text-indigo-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-sm font-black text-white">{activityCount} Logged Events</span>
                <span className="text-[10px] text-slate-400">Recorded in DB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action & Interactive Assistant Bar */}
        <div className="flex flex-col gap-3 min-w-[260px]">
          <button
            onClick={onOpenIntake}
            className="w-full bg-gradient-to-r from-rose-600 via-indigo-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white font-bold text-xs py-3 px-4 rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            + Simulate Webhook Inbound
          </button>

          {/* Prompt / Ask AI Bar */}
          <form onSubmit={handleAskAi} className="relative">
            <input
              type="text"
              placeholder="Ask AI Growth Assistant..."
              value={aiAssistantQuery}
              onChange={(e) => setAiAssistantQuery(e.target.value)}
              className="w-full bg-slate-950/90 border border-slate-800 focus:border-indigo-500 rounded-2xl py-2.5 pl-3.5 pr-10 text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isAiThinking}
              className="absolute right-1.5 top-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs transition-colors"
            >
              {isAiThinking ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* AI Assistant Output Box */}
      <AnimatePresence>
        {aiResponse && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-slate-800/80"
          >
            <div className="bg-slate-950/90 border border-indigo-500/30 rounded-2xl p-4 flex items-start gap-3">
              <Bot className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-slate-200 leading-relaxed">
                <span className="font-bold text-indigo-300 block mb-1">
                  ZA AI Operating System Response:
                </span>
                {aiResponse}
              </div>
              <button 
                onClick={() => setAiResponse(null)} 
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
