import React, { useState } from 'react';
import { 
  X, 
  KeyRound, 
  Database, 
  ExternalLink, 
  Check, 
  Copy, 
  RefreshCw, 
  AlertCircle,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { validateSupabaseKeys } from '../lib/supabase';

interface SecretsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

export const SecretsGuideModal: React.FC<SecretsGuideModalProps> = ({
  isOpen,
  onClose,
  onRefreshData
}) => {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  if (!isOpen) return null;

  const keyStatus = validateSupabaseKeys();

  const copyToClipboard = (text: string, varName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(varName);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const handleTestConnection = async () => {
    setIsChecking(true);
    await onRefreshData();
    setTimeout(() => {
      setIsChecking(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Supabase Connection & Secrets Guide
            </h3>
            <p className="text-xs text-slate-400">
              Configure environment variables to connect your live database
            </p>
          </div>
        </div>

        {/* Live Key Status Panel */}
        <div className="mb-5 p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-indigo-400" />
              Current Connection Status:
            </span>
            {keyStatus.isValid ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                <ShieldCheck className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                <AlertCircle className="w-3.5 h-3.5" /> Missing Keys ({keyStatus.missingKeys.length})
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${keyStatus.hasUrl ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-amber-950/30 border-amber-800/50 text-amber-300'}`}>
              <span className="font-mono text-[10px]">VITE_SUPABASE_URL</span>
              {keyStatus.hasUrl ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <X className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${keyStatus.hasAnonKey ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-amber-950/30 border-amber-800/50 text-amber-300'}`}>
              <span className="font-mono text-[10px]">VITE_SUPABASE_ANON_KEY</span>
              {keyStatus.hasAnonKey ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <X className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            </div>
          </div>
        </div>

        {/* Instructions Steps */}
        <div className="space-y-3.5 mb-6 text-xs text-slate-300">
          <p className="font-semibold text-slate-200">Follow these steps in your AI Studio Settings menu:</p>
          
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div className="flex-1">
                <p className="font-medium text-slate-200">Open Environment Secrets Settings</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Navigate to AI Studio Settings or project environment variables panel.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div className="flex-1 space-y-1.5">
                <p className="font-medium text-slate-200">Add Variable Names & Values</p>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                  <span className="font-mono text-[11px] text-amber-300">VITE_SUPABASE_URL</span>
                  <button 
                    onClick={() => copyToClipboard('VITE_SUPABASE_URL', 'url')} 
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[10px]"
                  >
                    {copiedVar === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedVar === 'url' ? 'Copied' : 'Copy Name'}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                  <span className="font-mono text-[11px] text-amber-300">VITE_SUPABASE_ANON_KEY</span>
                  <button 
                    onClick={() => copyToClipboard('VITE_SUPABASE_ANON_KEY', 'key')} 
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[10px]"
                  >
                    {copiedVar === 'key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedVar === 'key' ? 'Copied' : 'Copy Name'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div className="flex-1">
                <p className="font-medium text-slate-200">Copy from Supabase Settings &rarr; API Keys</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Use your Project URL and Publishable/Anon API key (<span className="font-mono text-slate-300">sb_publishable_...</span> or <span className="font-mono text-slate-300">eyJ...</span>).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
          >
            Open Supabase Dashboard
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleTestConnection}
              disabled={isChecking}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking...' : 'Re-check Connection'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
