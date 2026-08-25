import React, { useState } from 'react';
import { Lead, LeadComment, PipelineStage } from '../types';
import { logAiActionToSupabase } from '../lib/supabase';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink, 
  PhoneCall, 
  ShieldCheck, 
  MoreHorizontal,
  Flame,
  Clock,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SocialLeadCardProps {
  lead: Lead;
  onSelectLead: (lead: Lead) => void;
  onUpdateStage: (leadId: string, stage: PipelineStage) => void;
  onAddComment?: (leadId: string, commentText: string) => void;
}

export const SocialLeadCard: React.FC<SocialLeadCardProps> = ({
  lead,
  onSelectLead,
  onUpdateStage,
  onAddComment
}) => {
  const [liked, setLiked] = useState<boolean>(lead.likedByMe || false);
  const [likeCount, setLikeCount] = useState<number>(lead.likesCount || 12);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [newComment, setNewComment] = useState<string>('');
  const [commentsList, setCommentsList] = useState<LeadComment[]>(lead.comments || []);
  const [whatsAppSent, setWhatsAppSent] = useState<boolean>(false);
  const [isStageMenuOpen, setIsStageMenuOpen] = useState<boolean>(false);

  const handleLikeToggle = () => {
    if (liked) {
      setLiked(false);
      setLikeCount(prev => prev - 1);
    } else {
      setLiked(true);
      setLikeCount(prev => prev + 1);
    }
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const commentObj: LeadComment = {
      id: `c-${Date.now()}`,
      author: 'Enjy (Executive)',
      text: newComment.trim(),
      timestamp: 'Just now',
      isAi: false
    };

    setCommentsList(prev => [...prev, commentObj]);
    if (onAddComment) onAddComment(lead.id, newComment.trim());
    setNewComment('');
  };

  const handleSendWhatsApp = async () => {
    setWhatsAppSent(true);
    await logAiActionToSupabase({
      agent_name: 'WhatsApp Business API',
      action_type: 'whatsapp_dispatched',
      target_lead_id: lead.id,
      payload: {
        contactName: lead.contactName,
        companyName: lead.companyName,
        phone: lead.phone,
        message: lead.salesAutomation?.socialDmText || `Automated WhatsApp follow-up dispatched to ${lead.contactName}`
      },
      status: 'success'
    });
    setTimeout(() => setWhatsAppSent(false), 3000);
  };

  const getSourceBadgeColor = (source: Lead['source']) => {
    switch (source) {
      case 'Inbound WhatsApp': return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80';
      case 'LinkedIn Automation': return 'bg-blue-950/80 text-blue-400 border-blue-800/80';
      case 'Web Form': return 'bg-indigo-950/80 text-indigo-400 border-indigo-800/80';
      case 'Meta Ad': return 'bg-purple-950/80 text-purple-400 border-purple-800/80';
      default: return 'bg-slate-900 text-slate-300 border-slate-700';
    }
  };

  const getStageBadge = (stage: PipelineStage) => {
    switch (stage) {
      case 'intake': return { label: 'Inbound Intake', color: 'bg-slate-800 text-slate-300' };
      case 'qualified': return { label: 'AI Qualified', color: 'bg-indigo-950 text-indigo-300 border-indigo-700' };
      case 'discovery': return { label: 'Discovery Call', color: 'bg-amber-950 text-amber-300 border-amber-700' };
      case 'proposal': return { label: 'Proposal Sent', color: 'bg-purple-950 text-purple-300 border-purple-700' };
      case 'closed_won': return { label: 'Closed Won 🎉', color: 'bg-emerald-950 text-emerald-300 border-emerald-700' };
    }
  };

  const stageInfo = getStageBadge(lead.stage);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl hover:border-slate-700/80 transition-all mb-6"
    >
      {/* Post Top Header Bar (Instagram Style) */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="relative p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 rounded-full">
            <img 
              src={lead.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} 
              alt={lead.companyName}
              className="w-11 h-11 rounded-full object-cover bg-slate-950"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 
                onClick={() => onSelectLead(lead)}
                className="font-bold text-sm text-white hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-1.5"
              >
                {lead.companyName}
                <ShieldCheck className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
              </h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSourceBadgeColor(lead.source)}`}>
                {lead.source}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {lead.contactName} • <span className="text-slate-500">{lead.createdAt}</span>
            </p>
          </div>
        </div>

        {/* Action Dropdown / Stage Pill */}
        <div className="relative">
          <button 
            onClick={() => setIsStageMenuOpen(!isStageMenuOpen)}
            className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 transition-all ${stageInfo.color}`}
          >
            <span>{stageInfo.label}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {isStageMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl z-20 py-1 text-xs">
              <div className="px-3 py-1.5 font-bold text-slate-400 uppercase text-[10px] border-b border-slate-800">
                Move Pipeline Stage
              </div>
              {(['intake', 'qualified', 'discovery', 'proposal', 'closed_won'] as PipelineStage[]).map((stage) => (
                <button
                  key={stage}
                  onClick={() => {
                    onUpdateStage(lead.id, stage);
                    setIsStageMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-900 hover:text-white capitalize flex items-center justify-between ${
                    lead.stage === stage ? 'text-indigo-400 font-bold bg-indigo-950/40' : ''
                  }`}
                >
                  <span>{stage.replace('_', ' ')}</span>
                  {lead.stage === stage && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Post Main Body Container (Glassmorphic Social Card) */}
      <div className="p-5 space-y-4">
        {/* Caption Header */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-medium">
            🔥 <strong className="text-white">AI Growth Engine Update:</strong> High priority opportunity identified. Verified purchasing decision maker at <span className="text-indigo-300 font-semibold">{lead.companyName}</span> ({lead.industry}).
          </p>
          <span className="flex-shrink-0 text-xs font-black text-rose-400 bg-rose-950/60 border border-rose-800/80 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" />
            {lead.status} Lead
          </span>
        </div>

        {/* AI Audit & Score Visual Card */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                AI Qualification Score
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">
                Budget: <strong className="text-emerald-400">${lead.monthlyBudget.toLocaleString()}/mo</strong>
              </span>
              <span className="text-xs font-black text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800">
                {lead.score.overallScore}/100
              </span>
            </div>
          </div>

          {/* Key Insights bullets */}
          <div className="space-y-1.5 pt-1">
            {lead.score.keyInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-indigo-400 font-bold">•</span>
                <span>{insight}</span>
              </div>
            ))}
          </div>

          {/* Recommended Action Pill */}
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Recommended Next Action:</span>
            <span className="text-amber-300 font-bold bg-amber-950/50 border border-amber-800/50 px-2.5 py-0.5 rounded-lg truncate max-w-[240px]">
              {lead.score.recommendedAction}
            </span>
          </div>
        </div>

        {/* Estimated Value Banner */}
        <div className="flex items-center justify-between text-xs p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-xl">
          <span className="text-slate-300">
            Estimated Annual Deal Value: <strong className="text-white font-bold">${lead.estimatedValue.toLocaleString()}</strong>
          </span>
          <span className="text-slate-400">
            Assigned: <strong className="text-indigo-300">{lead.assignedAgent}</strong>
          </span>
        </div>
      </div>

      {/* Engagement Action Bar (Like, Comment, WhatsApp, Audit) */}
      <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Like Button */}
          <button 
            onClick={handleLikeToggle}
            className={`flex items-center gap-1.5 text-xs font-bold transition-all ${
              liked ? 'text-rose-500 scale-105' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-rose-500' : ''}`} />
            <span>{likeCount}</span>
          </button>

          {/* Comment Button */}
          <button 
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{commentsList.length} Notes</span>
          </button>

          {/* Quick WhatsApp Automation */}
          <button 
            onClick={handleSendWhatsApp}
            disabled={whatsAppSent}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
              whatsAppSent 
                ? 'bg-emerald-600 text-white border-emerald-500' 
                : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border-emerald-800/80'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>{whatsAppSent ? 'WhatsApp Sent ✓' : 'Send WhatsApp'}</span>
          </button>
        </div>

        {/* Full Details Modal Trigger */}
        <button 
          onClick={() => onSelectLead(lead)}
          className="flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <span>Inspect AI Audit</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expandable Comments / Notes Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-950 p-4 border-t border-slate-800/80 space-y-3"
          >
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {commentsList.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No notes added yet. Add an executive note below.</p>
              ) : (
                commentsList.map((c) => (
                  <div key={c.id} className="text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold ${c.isAi ? 'text-indigo-400' : 'text-slate-200'}`}>
                        {c.author}
                      </span>
                      <span className="text-[10px] text-slate-500">{c.timestamp}</span>
                    </div>
                    <p className="text-slate-300">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Input comment */}
            <form onSubmit={handleSendComment} className="flex gap-2 pt-2">
              <input 
                type="text" 
                placeholder="Add an executive note or prompt..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
              />
              <button 
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-2 rounded-xl"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
