import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Zap, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Database
} from 'lucide-react';

interface LoginPageProps {
  onSwitchToSignup: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignup }) => {
  const { signInWithEmail, signInWithGoogle, isSupabaseConfigured } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { error: authError } = await signInWithGoogle();
      if (authError) {
        setError(authError.message || 'Failed to sign in with Google.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during Google sign in.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await signInWithEmail(email.trim(), password);
      if (authError) {
        setError(authError.message || 'Invalid email or password.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans text-slate-100">
      {/* Background Decorator Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-blue-600/15 via-indigo-600/20 to-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-xl shadow-indigo-950/40">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 font-bold text-2xl">
              ZA
            </div>
            <div className="text-left pr-2">
              <h1 className="font-extrabold text-lg text-white tracking-tight leading-none">
                ZA MEDIA
              </h1>
              <p className="text-xs text-indigo-400 font-medium mt-1 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400 fill-amber-400" /> AI Growth Engine
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Welcome back
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Sign in to access your Executive Growth Operating System
            </p>
          </div>
        </div>

        {/* Supabase Connection Status Card */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Database className={`w-4 h-4 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="text-slate-300 font-medium">
              {isSupabaseConfigured ? 'Supabase Auth Active' : 'Demo Local Auth Mode'}
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            isSupabaseConfigured 
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
              : 'bg-amber-950 text-amber-300 border-amber-800'
          }`}>
            {isSupabaseConfigured ? 'Live Cloud' : 'Ready'}
          </span>
        </div>

        {/* Form Container */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-6 shadow-2xl shadow-black/80 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-white font-semibold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {googleLoading ? (
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-slate-800 w-full"></div>
            <span className="bg-slate-900 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">
              or continue with email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="admin@zamedia.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <span className="text-[11px] text-slate-500 hover:text-indigo-400 cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs py-3 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Signup */}
          <div className="pt-2 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-400">
              Don't have an executive account?{' '}
              <button
                type="button"
                onClick={onSwitchToSignup}
                className="text-indigo-400 font-semibold hover:text-indigo-300 hover:underline"
              >
                Create Account
              </button>
            </p>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px]">256-bit Encrypted Sessions</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px]">AI Real-time Intelligence</span>
          </div>
        </div>
      </div>
    </div>
  );
};
