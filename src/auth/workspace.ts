import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export const ZA_MEDIA_WORKSPACE_ID = '37996c28-d9f9-4e5c-895d-692b8a1f23e0'

export type ActiveWorkspace = {
  id: string
  name: string
  slug: string
}

export async function resolveActiveWorkspace(user: User): Promise<ActiveWorkspace | null> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name, slug)')
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  const memberships = (data ?? []) as Array<{
    workspace_id: string
    workspaces: ActiveWorkspace | ActiveWorkspace[] | null
  }>

  const normalized = memberships
    .map((membership) => {
      const workspace = Array.isArray(membership.workspaces)
        ? membership.workspaces[0]
        : membership.workspaces
      return workspace ? { ...workspace, id: membership.workspace_id } : null
    })
    .filter((workspace): workspace is ActiveWorkspace => Boolean(workspace))

  return normalized.find((workspace) => workspace.slug === 'za-media') ?? normalized[0] ?? null
}

export async function claimZaMediaWorkspace(): Promise<ActiveWorkspace> {
  const { data, error } = await supabase.rpc('claim_unowned_workspace', {
    target_workspace_id: ZA_MEDIA_WORKSPACE_ID,
  })

  if (error) throw new Error(error.message)
  if (!data) throw new Error('ZA Media workspace could not be activated.')

  const workspace = data as ActiveWorkspace
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
  }
}
