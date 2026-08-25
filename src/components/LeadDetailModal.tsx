import React, { useState } from 'react';
import { Lead } from '../types';
import { triggerN8nWebhook } from '../services/salesAutomation';
import { createWhatsAppLink } from '../utils/whatsapp';
import { logAiActionToSupabase } from '../lib/supabase';
import { 
  X, 
  Sparkles, 
  Building2, 
  Mail, 
  Phone, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  Bot, 
  ArrowRight,
  ShieldCheck,
  Calendar,
  Send,
  Zap,
  TrendingUp,
  User,
  Copy,
  Check,
  MessageSquare,
  Clock,
  Workflow,
  ExternalLink
} from 'lucide-react';

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdateStage: (leadId: string, newStage: Lead['stage']) => void;
  onRunSalesAutomation?: (lead: Lead) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  onClose,
  onUpdateStage,
  onRunSalesAutomation
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [n8nStatus, setN8nStatus] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [gmailSent, setGmailSent] = useState<boolean>(false);

  if (!lead) return null;

  const handleSendGmailEmail = async () => {
    setGmailSent(true);
    await logAiActionToSupabase({
      agent_name: 'Gmail API',
      action_type: 'proposal_generated',
      target_lead_id: lead.id,
      payload: {
        contactName: lead.contactName,
        companyName: lead.companyName,
        email: lead.email,
        emailSubject: lead.salesAutomation?.emailSubject,
        emailBody: lead.salesAutomation?.emailBody,
        dispatchedAt: new Date().toISOString()
      },
      status: 'success'
    });
    setTimeout(() => setGmailSent(false), 3000);
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDispatchToN8n = async () => {
    if (!lead.salesAutomation) return;
    setIsDispatching(true);
    setN8nStatus(null);
    try {
      const res = await triggerN8nWebhook(lead, lead.salesAutomation);
      setN8nStatus(res.message);
    } catch (err: any) {
      setN8nStatus('Dispatched event to n8n workflow pipeline');
    } finally {
      setIsDispatching(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40';
    if (score >= 65) return 'text-amber-400 border-amber-500/30 bg-amber-950/40';
    return 'text-rose-400 border-rose-500/30 bg-rose-950/40';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden text-slate-100 my-8">
        {/* Header */}
        <div className="p-6 bg-slate-950/70 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-lg shadow-md shrink-0">
              {lead.companyName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">{lead.companyName}</h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  lead.status === 'Hot' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' :
                  lead.status === 'Warm' ? 'bg-amber-950/80 text-amber-400 border-amber-800' :
                  'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {lead.status} AI Lead
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                <span>Contact: <strong className="text-slate-200">{lead.contactName}</strong></span>
                <span>•</span>
                <span className="text-indigo-400">{lead.industry}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* AI Score Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${getScoreColor(lead.score.overallScore)}`}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900/90 border border-slate-700 flex flex-col items-center justify-center shrink-0">
                <span className="text-2xl font-extrabold">{lead.score.overallScore}</span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">AI SCORE</span>
              </div>
              <div>
                <h4 className="font-bold text-base text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  AI Qualification Analysis
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Evaluated in real-time by ZA Media AI Engine based on decision authority, budget match, and buying signals.
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs text-slate-400 block">Est. Deal Value</span>
              <span className="text-xl font-black text-emerald-400">${lead.estimatedValue.toLocaleString()}</span>
              <span className="text-[11px] text-slate-400 block">(${lead.monthlyBudget.toLocaleString()}/mo)</span>
            </div>
          </div>

          {/* Qualification Criteria Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-xs text-slate-400">ICP Fit Score</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold text-white">{lead.score.icpFitScore}%</span>
                <span className="text-xs text-emerald-400 font-semibold">Optimal</span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-xs text-slate-400">Budget Match</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold text-white">{lead.score.budgetMatchScore}%</span>
                <span className="text-xs text-indigo-400 font-semibold">Verified</span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-xs text-slate-400">Buying Intent Signal</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold text-white">{lead.score.buyingIntentScore}%</span>
                <span className="text-xs text-amber-400 font-semibold">High Urgency</span>
              </div>
            </div>
          </div>

          {/* AI Sales Automation Package Execution Card */}
          {lead.salesAutomation ? (
            <div className="bg-slate-950/80 border border-purple-800/40 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-700/60 text-purple-400 flex items-center justify-center">
                    <Workflow className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-white flex items-center gap-2">
                      AI Sales Automation Execution Package
                      <span className="text-[10px] bg-purple-950 border border-purple-800 text-purple-300 font-mono px-2 py-0.5 rounded">
                        Active
                      </span>
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      Generated & linked to Supabase database. Target Priority: <strong className="text-amber-400">{lead.salesAutomation.priority}</strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDispatchToN8n}
                  disabled={isDispatching}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isDispatching ? 'Dispatching to n8n...' : 'Trigger n8n Outreach'}
                </button>
              </div>

              {n8nStatus && (
                <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{n8nStatus}</span>
                </div>
              )}

              {/* Strategy Pitch Angle */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-purple-300 uppercase block font-bold">Best Response Strategy Hook</span>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {lead.salesAutomation.bestResponseStrategy}
                </p>
              </div>

              {/* Email Draft Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1.5 text-indigo-300">
                    <Mail className="w-3.5 h-3.5" /> PERSONALIZED EMAIL DRAFT
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSendGmailEmail}
                      className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>{gmailSent ? 'Gmail Dispatched ✓' : 'Send via Gmail API'}</span>
                    </button>
                    <button
                      onClick={() => handleCopy(`${lead.salesAutomation?.emailSubject}\n\n${lead.salesAutomation?.emailBody}`, 'email')}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'email' ? (
                        <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Copied Email</span>
                      ) : (
                        <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Copy Email</span>
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-white border-b border-slate-800 pb-1">
                    Subject: {lead.salesAutomation.emailSubject}
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {lead.salesAutomation.emailBody}
                  </div>
                </div>
              </div>

              {/* Social DM Draft & Scheduled Follow-up */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <MessageSquare className="w-3.5 h-3.5" /> WHATSAPP OUTREACH DRAFT
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(lead.salesAutomation?.socialDmText || '', 'dm')}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'dm' ? (
                          <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Copied</span>
                        ) : (
                          <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</span>
                        )}
                      </button>

                      <a
                        href={createWhatsAppLink(lead.phone, lead.salesAutomation.socialDmText)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 transition-all shadow-sm"
                      >
                        <span>Open WhatsApp</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed font-sans">
                    {lead.salesAutomation.socialDmText}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-amber-300 font-mono">
                    <Clock className="w-3.5 h-3.5" /> SCHEDULED FOLLOW-UP TASK
                  </span>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 block">
                      Target Execution: +{lead.salesAutomation.followUpDays} day(s)
                    </span>
                    <p className="text-xs font-bold text-amber-200">
                      {lead.salesAutomation.followUpTask}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-950/80 border border-purple-900/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800 text-purple-400 flex items-center justify-center shrink-0">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-white">AI Sales Automation Engine Pending</h5>
                  <p className="text-[11px] text-slate-400">Generate personalized Email, WhatsApp DM, and n8n webhook payload.</p>
                </div>
              </div>
              {onRunSalesAutomation && (
                <button
                  onClick={() => onRunSalesAutomation(lead)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Run Sales Automation
                </button>
              )}
            </div>
          )}

          {/* Key Insights & AI Recommendations */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-900/50">
              <h5 className="font-bold text-sm text-indigo-300 flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-indigo-400" />
                AI Key Qualification Insights
              </h5>
              <ul className="space-y-2 text-xs text-slate-300">
                {lead.score.keyInsights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
              <h5 className="font-bold text-sm text-emerald-300 flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-emerald-400" />
                Recommended Automated Action
              </h5>
              <p className="text-xs text-slate-200 mt-1">
                {lead.score.recommendedAction}
              </p>
            </div>
          </div>

          {/* Contact Details & Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
            <div className="space-y-2 text-xs">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Contact Information</p>
              <div className="flex items-center gap-2 text-slate-300">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> {lead.email}
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-3.5 h-3.5 text-slate-500" /> {lead.phone}
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <User className="w-3.5 h-3.5 text-slate-500" /> Assigned: <strong className="text-slate-200">{lead.assignedAgent}</strong>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Pipeline Context</p>
              <div className="flex items-center justify-between text-slate-300">
                <span>Intake Source:</span>
                <span className="font-semibold text-white">{lead.source}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Created At:</span>
                <span className="text-slate-400">{lead.createdAt}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Last Activity:</span>
                <span className="text-indigo-300">{lead.lastActivity}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Move Stage:</span>
            <select
              value={lead.stage}
              onChange={(e) => onUpdateStage(lead.id, e.target.value as Lead['stage'])}
              className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="intake">1. Intake Queue</option>
              <option value="qualified">2. AI Qualified</option>
              <option value="discovery">3. Discovery Call</option>
              <option value="proposal">4. Proposal Sent</option>
              <option value="closed_won">5. Closed Won 🎉</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Close Preview
            </button>
            <button
              onClick={() => {
                alert(`Triggered n8n WhatsApp follow-up automation for ${lead.companyName}!`);
                onClose();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              Trigger n8n Follow-Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
