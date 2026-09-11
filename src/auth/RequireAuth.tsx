import { useEffect, useState, type ReactNode } from 'react'
import { LoginPage } from './LoginPage'
import { useAuth } from './AuthProvider'
import { claimUnownedZaMediaWorkspace, resolveWorkspace, type Workspace } from './workspace'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) { setWorkspace(null); return }
    setWorkspaceLoading(true)
    void resolveWorkspace().then(setWorkspace).catch((e) => setError(e instanceof Error ? e.message : 'Unable to resolve workspace')).finally(() => setWorkspaceLoading(false))
  }, [session])

  if (loading) return <div className="min-h-screen bg-neutral-950 text-white grid place-items-center">Loading session…</div>
  if (!session) return <LoginPage />
  if (workspaceLoading) return <div className="min-h-screen bg-neutral-950 text-white grid place-items-center">Resolving workspace…</div>
  if (!workspace) return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4"><div className="max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-8 text-center"><h1 className="font-display text-xl font-bold">Workspace access</h1><p className="mt-2 text-sm text-neutral-400">Your account has no workspace membership yet. If the ZA Media workspace is still unowned, you can claim it as its first owner.</p>{error && <p className="mt-4 text-sm text-error-400">{error}</p>}<button className="btn-primary mt-6 w-full" onClick={() => { setError(''); setWorkspaceLoading(true); void claimUnownedZaMediaWorkspace().then(setWorkspace).catch((e) => setError(e instanceof Error ? e.message : 'Workspace claim failed')).finally(() => setWorkspaceLoading(false)) }}>Connect to ZA Media</button></div></div>
  return <>{children}</>
}
