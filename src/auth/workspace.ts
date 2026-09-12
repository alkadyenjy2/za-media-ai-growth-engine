import { supabase } from '../lib/supabase'

const ZA_MEDIA_WORKSPACE_SLUG = 'za-media'
const ZA_MEDIA_WORKSPACE_NAME = 'ZA Media'

export async function resolveWorkspace() {
  const { data, error } = await supabase.from('workspace_members').select('workspace_id, role').maybeSingle()
  if (error) throw error
  if (data) return data

  const { data: created, error: createError } = await supabase.rpc('create_workspace_with_owner', {
    workspace_name: ZA_MEDIA_WORKSPACE_NAME,
    workspace_slug: ZA_MEDIA_WORKSPACE_SLUG,
  })
  if (createError) throw new Error(createError.message ?? String(createError))
  return { workspace_id: created.id, role: 'owner' as const }
}
