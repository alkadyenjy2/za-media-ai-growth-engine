import { supabase } from '../lib/supabase'

export type Workspace = { id: string; name: string; slug: string }
type MembershipRow = { workspace_id: string; role: string; workspaces: Workspace | Workspace[] | null }

export async function resolveWorkspace(): Promise<Workspace | null> {
  const { data: memberships, error } = await supabase.from('workspace_members').select('workspace_id, role, workspaces(id,name,slug)')
  if (error) throw error
  const rows = (memberships ?? []) as MembershipRow[]
  const normalized = rows.map((row) => ({ ...row, workspaces: Array.isArray(row.workspaces) ? row.workspaces[0] ?? null : row.workspaces }))
  const za = normalized.find((row) => row.workspaces?.slug === 'za-media')
  return za?.workspaces ?? normalized[0]?.workspaces ?? null
}

export async function claimUnownedZaMediaWorkspace() {
  const { data, error } = await supabase.rpc('claim_unowned_workspace', { target_workspace_slug: 'za-media' })
  if (error) throw error
  return data as Workspace
}
