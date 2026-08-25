import React, { useState } from 'react';
import { Lead } from '../types';
import { X, Sparkles, Send, Building2, User, Mail, Phone, DollarSign, Bot, CheckCircle, AlertCircle } from 'lucide-react';

interface LeadIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitLead: (newLead: Lead) => Promise<void>;
}

export const LeadIntakeModal: React.FC<LeadIntakeModalProps> = ({
  isOpen,
  onClose,
  onSubmitLead,
}) => {
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [industry, setIndustry] = useState('SaaS & AI');
  const [monthlyBudget, setMonthlyBudget] = useState('10000');
  const [source, setSource] = useState<Lead['source']>('Web Form');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isScoring, setIsScoring] = useState(false);

  if (!isOpen) return null;

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const validatePhone = (val: string) => !val || /^[+0-9\s\-()]{7,20}$/.test(val);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!contactName.trim() || !companyName.trim() || !email.trim()) {
      setValidationError('Please fill in all required fields (Name, Company, and Email).');
      return;
    }

    if (!validateEmail(email)) {
      setValidationError('Please enter a valid work email address (e.g. name@company.com).');
      return;
    }

    if (phone.trim() && !validatePhone(phone)) {
      setValidationError('Please enter a valid phone number (digits, +, hyphens allowed).');
      return;
    }

    setIsScoring(true);
    const budgetNum = Math.max(0, Number(monthlyBudget) || 0);
    const leadId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');

    const newLead: Lead = {
      id: leadId,
      contactName: contactName.trim(),
      companyName: companyName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      source,
      industry: industry.trim(),
      estimatedValue: 0,
      monthlyBudget: budgetNum,
      stage: 'intake',
      status: 'Warm',
      score: {
        overallScore: 0,
        icpFitScore: 0,
        budgetMatchScore: 0,
        buyingIntentScore: 0,
        decisionMakerVerified: false,
        keyInsights: [],
        recommendedAction: 'Awaiting server-side qualification'
      },
      createdAt: new Date().toISOString(),
      lastActivity: 'Awaiting server-side AI qualification',
      notes: notes.trim(),
      assignedAgent: 'Pending server qualification'
    };

    try {
      await onSubmitLead(newLead);
      setContactName('');
      setCompanyName('');
      setEmail('');
      setPhone('');
      setNotes('');
      setValidationError('');
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || 'The lead could not be saved. No success was recorded.');
    } finally {
      setIsScoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Add Inbound Lead</h3>
              <p className="text-xs text-slate-400">Persists the lead, then runs server-side qualification</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {validationError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Name *</label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Mansoor"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name *</label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Tech UAE"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Work Email *</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="tariq@apex.ae"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="tel"
                  placeholder="+971 50 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Monthly Budget ($)</label>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="number"
                  placeholder="12000"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Intake Channel</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as Lead['source'])}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Web Form">Web Form</option>
                <option value="LinkedIn Automation">LinkedIn Automation</option>
                <option value="Inbound WhatsApp">Inbound WhatsApp</option>
                <option value="Meta Ad">Meta Ad</option>
                <option value="Cold Outreach">Cold Outreach</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Industry Vertical</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Project Details / Requirements</label>
            <textarea
              rows={2}
              placeholder="Needs AI automated client qualification, CRM sync, and automated follow-up..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Submit CTA */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isScoring}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
            >
              {isScoring ? (
                <>
                  <Bot className="w-4 h-4 animate-spin text-amber-300" />
                  <span>AI Agent Scoring...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Qualify & Save Lead</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
