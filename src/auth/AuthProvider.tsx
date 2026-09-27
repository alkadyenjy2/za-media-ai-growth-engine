import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { authClient } from '../lib/auth-client'
type AuthContextValue = { session: any; user: any; loading: boolean; signOut: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const state = authClient.useSession()
  const session = state.data ?? null
  const user = session?.user ?? null
  const ensureWorkspace = useMutation(api.core.ensureWorkspace)
  useEffect(() => {
    if (user) void ensureWorkspace()
  }, [user?.id, ensureWorkspace])
  const value = useMemo(() => ({ session, user, loading: state.isPending, signOut: async () => { await authClient.signOut() } }), [session, user, state.isPending])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}



