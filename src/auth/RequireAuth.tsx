import type { ReactNode } from 'react'
import { LoginPage } from './LoginPage'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-500">Loading workspace…</div>
  if (!user) return <LoginPage />
  return <>{children}</>
}
