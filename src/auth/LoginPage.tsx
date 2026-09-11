import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (result.error) setMessage(result.error.message)
    else if (mode === 'signup' && !result.data.session) setMessage('Account created. Check your email if confirmation is enabled, then sign in.')
    setBusy(false)
  }

  return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-8 shadow-2xl">
      <div className="mb-8 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500 font-display text-xl font-bold">Z</div><h1 className="font-display text-2xl font-bold">ZA Media Growth Engine</h1><p className="mt-2 text-sm text-neutral-400">{mode === 'signin' ? 'Sign in to your operational workspace.' : 'Create your operational account.'}</p></div>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-400">Email</label><input className="input bg-white/5 border-white/10 text-white" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-400">Password</label><input className="input bg-white/5 border-white/10 text-white" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {message && <p className="rounded-lg bg-warning-500/10 px-3 py-2 text-sm text-warning-300">{message}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button className="mt-5 w-full text-sm text-neutral-400 hover:text-white" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>{mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button>
    </div>
  </div>
}
