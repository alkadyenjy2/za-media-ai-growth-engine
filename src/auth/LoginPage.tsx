import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    setLoading(false)
    if (result.error) return setMessage(result.error.message)

    if (mode === 'sign-up' && !result.data.session) {
      const identities = result.data.user?.identities ?? []
      return setMessage(
        identities.length === 0
          ? 'An account with this email may already exist. Sign in instead.'
          : 'Check your email to confirm the new account.'
      )
    }

    setMessage('Authenticated.')
  }

  return <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">ZA Media</p><h1 className="mt-2 text-2xl font-semibold text-neutral-900">{mode === 'sign-in' ? 'Sign in' : 'Create account'}</h1><p className="mt-1 text-sm text-neutral-500">Authenticated workspace access.</p></div><div className="space-y-4"><label className="block text-sm font-medium text-neutral-700">Email<input className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-primary-500" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label className="block text-sm font-medium text-neutral-700">Password<input className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-primary-500" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label></div>{message && <p className="mt-4 text-sm text-neutral-600">{message}</p>}<button className="mt-6 w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={loading}>{loading ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button><button type="button" className="mt-3 w-full text-sm text-primary-700" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage('') }}>{mode === 'sign-in' ? 'Create a new account' : 'Back to sign in'}</button></form></div>
}
