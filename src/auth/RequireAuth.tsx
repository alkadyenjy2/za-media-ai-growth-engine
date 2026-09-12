import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { LoginPage } from './LoginPage'
import { claimZaMediaWorkspace, resolveActiveWorkspace, type ActiveWorkspace } from './workspace'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, user, loading, signOut } = useAuth()
  const [workspace, setWorkspace] = useState<ActiveWorkspace | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')

  useEffect(() => {
    if (!user) {
      setWorkspace(null)
      return
    }

    let cancelled = false
    setWorkspaceLoading(true)
    setWorkspaceError('')

    void resolveActiveWorkspace(user)
      .then((activeWorkspace) => {
        if (!cancelled) setWorkspace(activeWorkspace)
      })
      .catch((error) => {
        if (!cancelled) setWorkspaceError(error instanceof Error ? error.message : 'Workspace lookup failed.')
      })
      .finally(() => {
        if (!cancelled) setWorkspaceLoading(false)
      })

    return () => { cancelled = true }
  }, [user])

  if (loading) {
    return <main className="min-h-screen bg-neutral-950 p-8 text-neutral-400">Loading secure session...</main>
  }

  if (!session || !user) return <LoginPage />

  if (workspaceLoading) {
    return <main className="min-h-screen bg-neutral-950 p-8 text-neutral-400">Resolving workspace...</main>
  }

  if (!workspace) {
    const activate = async () => {
      setWorkspaceLoading(true)
      setWorkspaceError('')
      try {
        const activeWorkspace = await claimZaMediaWorkspace()
        setWorkspace(activeWorkspace)
      } catch (error) {
        setWorkspaceError(error instanceof Error ? error.message : 'Workspace activation failed.')
      } finally {
        setWorkspaceLoading(false)
      }
    }

    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
          <h1 className="font-display text-xl font-bold">Workspace access required</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-400">Your account is authenticated, but it is not a member of the ZA Media workspace yet.</p>
          {workspaceError && <p className="mt-4 text-sm text-error-400">{workspaceError}</p>}
          <button type="button" onClick={activate} disabled={workspaceLoading} className="btn-primary mt-6 w-full">
            {workspaceLoading ? 'Activating...' : 'Activate ZA Media access'}
          </button>
          <button type="button" onClick={() => void signOut()} className="mt-3 w-full text-sm text-neutral-400 hover:text-white">Sign out</button>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
