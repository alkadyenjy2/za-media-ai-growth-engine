import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

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
  const { data, error } = await supabase.rpc('create_workspace_with_owner', {
    workspace_name: 'ZA Media',
    workspace_slug: 'za-media',
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
