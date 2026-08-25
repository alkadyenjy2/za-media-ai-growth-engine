import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Sparkles, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle2, 
  DollarSign, 
  Globe, 
  ArrowRight, 
  RefreshCw,
  Zap,
  Target,
  FileText
} from 'lucide-react';
import { 
  MarketResearchReport, 
  runMarketIntelligenceResearch, 
  getSavedResearchReports 
} from '../services/researchAgent';

export const MarketResearchHub: React.FC = () => {
  const [topic, setTopic] = useState<string>('High-Ticket B2B AI Automation & SDR Retainers');
  const [niche, setNiche] = useState<string>('Home Services & Roofing Contractors');
  const [competitorFocus, setCompetitorFocus] = useState<string>('Traditional Marketing Agencies & Generic SaaS');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [currentReport, setCurrentReport] = useState<MarketResearchReport | null>(null);
  const [savedReports, setSavedReports] = useState<MarketResearchReport[]>([]);

  useEffect(() => {
    const saved = getSavedResearchReports();
    setSavedReports(saved);
    if (saved.length > 0) {
      setCurrentReport(saved[0]);
    }
  }, []);

  const handleExecuteResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic && !niche) return;

    setIsSearching(true);
    try {
      const report = await runMarketIntelligenceResearch({
        topic,
        niche,
        competitorFocus
      });
      setCurrentReport(report);
      setSavedReports(getSavedResearchReports());
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950/60 to-slate-900 border border-blue-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-700 text-blue-300 font-mono text-[10px] font-bold uppercase flex items-center gap-1">
                <Globe className="w-3 h-3 text-cyan-400" /> Live Market Intelligence
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-[10px] font-bold">
                Tavily Web Search + Gemini 2.5
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Market Intelligence & Competitor Analysis Agent</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Autonomous market research agent. Discovers emerging industry trends, audits competitor positioning & weaknesses, identifies underserved market gaps, and recommends high-margin offers.
            </p>
          </div>
        </div>
      </div>

      {/* Search & Query Input Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleExecuteResearch} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Research Focus / Topic</label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. High-Ticket B2B AI SDR Services"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Target Niche / Vertical</label>
              <input
                type="text"
                required
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Roofing Contractors, Solar, Medspas"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Competitor Targets to Audit</label>
              <input
                type="text"
                value={competitorFocus}
                onChange={(e) => setCompetitorFocus(e.target.value)}
                placeholder="e.g. Legacy Retainer Agencies"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Real-time competitor audit & offer packaging</span>
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scanning Market Intel...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Market Intelligence Scan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Active Intelligence Report Output */}
      {currentReport && (
        <div className="space-y-6">
          {/* Executive Summary & Opportunity Score */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  Executive Intelligence Summary
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(currentReport.generatedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {currentReport.executiveSummary}
              </p>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-indigo-300">
                <strong>Market Dynamics & TAM:</strong> {currentReport.marketSizeGrowth}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-2 shadow-xl">
              <span className="text-[10px] uppercase font-mono text-slate-400">Opportunity Score</span>
              <div className="text-4xl font-black text-emerald-400">{currentReport.opportunityScore}/100</div>
              <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-bold rounded-full">
                HIGH COMMERCIAL VIABILITY
              </span>
            </div>
          </div>

          {/* Key Trends & Identified Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
              <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Actionable Emerging Trends
              </h4>
              <ul className="space-y-2 text-xs">
                {currentReport.keyTrends.map((trend, i) => (
                  <li key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-slate-300 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{trend}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
              <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Underserved Market Gaps (Vulnerabilities)
              </h4>
              <ul className="space-y-2 text-xs">
                {currentReport.identifiedGaps.map((gap, i) => (
                  <li key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-slate-300 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5"></span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Competitor Audit Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider">
              Competitor Positioning & Vulnerability Matrix
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {currentReport.competitorAnalysis.map((comp, i) => (
                <div key={i} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{comp.competitorName}</span>
                    <span className="font-mono text-[10px] text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                      {comp.pricingModel}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    <strong className="text-slate-300">Positioning:</strong> {comp.positioning}
                  </p>
                  <p className="text-rose-300/90 text-[11px] bg-rose-950/40 p-2 rounded border border-rose-900/50">
                    <strong>Vulnerability:</strong> {comp.vulnerabilities}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended High-Margin Offers */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Recommended High-Margin Packaging
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {currentReport.recommendedOffers.map((off, i) => (
                <div key={i} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 text-sm">{off.offerTitle}</span>
                      <span className="font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {off.targetPrice}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      <strong>Deliverable:</strong> {off.deliverableFormat}
                    </p>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      <strong>Why It Wins:</strong> {off.whyItWins}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-900 text-[10px] text-emerald-400 font-mono font-bold">
                    Est. Margin: {off.estimatedMargin}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actionable Viral Hooks */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              Ready-to-Use Marketing Hooks & Angles
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {currentReport.viralHooksAndAngles.map((hook, i) => (
                <div key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-slate-200 flex items-start gap-2">
                  <span className="text-indigo-400 font-bold font-mono">#{i + 1}</span>
                  <p className="text-[11px] leading-relaxed italic">"{hook}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
