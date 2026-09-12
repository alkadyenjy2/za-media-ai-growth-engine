import { FormEvent, useState } from 'react'
import { useAuth } from './AuthProvider'
import { claimZaMediaWorkspace, resolveActiveWorkspace } from './workspace'

export function LoginPage() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    const result = mode === 'sign-in'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password)

    if (result.error) {
      setMessage(result.error.message)
      setSaving(false)
      return
    }

    if (mode === 'sign-up') {
      setMessage('Account created. If email confirmation is enabled, confirm your email, then sign in.')
      setMode('sign-in')
      setSaving(false)
      return
    }

    if (user) {
      try {
        const workspace = await resolveActiveWorkspace(user)
        if (!workspace) await claimZaMediaWorkspace()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Workspace activation failed.')
      }
    }

    setSaving(false)
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-16 text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <div className="mb-8">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 font-display font-bold">Z</div>
          <h1 className="font-display text-2xl font-bold">ZA Media Dashboard</h1>
          <p className="mt-2 text-sm text-neutral-400">Sign in to access operational data.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-400">Email</label>
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input w-full bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-400">Password</label>
            <input type="password" required minLength={6} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="input w-full bg-white/5 border-white/10 text-white" />
          </div>
          {message && <p className="text-sm text-error-400">{message}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage('') }} className="mt-5 w-full text-sm text-neutral-400 hover:text-white">
          {mode === 'sign-in' ? 'First time here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </main>
  )
}
