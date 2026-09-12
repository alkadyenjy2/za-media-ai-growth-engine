import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { resolveWorkspace } from './workspace'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')

  useEffect(() => {
    if (!user) {
      setWorkspaceLoading(false)
      setWorkspaceError('')
      return
    }
    let mounted = true
    setWorkspaceLoading(true)
    setWorkspaceError('')
    void resolveWorkspace()
      .catch((error) => {
        if (mounted) setWorkspaceError(error instanceof Error ? error.message : 'Workspace access failed')
      })
      .finally(() => {
        if (mounted) setWorkspaceLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [user])

  // The dashboard shell is public. Real data remains protected by Supabase RLS:
  // unauthenticated visitors can see the UI but cannot read/write tenant data.
  if (loading || workspaceLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-500">Loading workspace…</div>
  }

  if (workspaceError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-neutral-900">Workspace access unavailable</h1>
          <p className="mt-2 text-sm text-neutral-600">{workspaceError}</p>
          <button className="mt-5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
