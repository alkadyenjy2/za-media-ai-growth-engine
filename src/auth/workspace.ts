import { supabase } from '../lib/supabase'

const ZA_MEDIA_WORKSPACE_SLUG = 'za-media'

export async function resolveWorkspace() {
  const { data, error } = await supabase.from('workspace_members').select('workspace_id, role').maybeSingle()
  if (error) throw error
  if (data) return data
  const { data: claimed, error: claimError } = await supabase.rpc('claim_unowned_workspace', { target_workspace_slug: ZA_MEDIA_WORKSPACE_SLUG })
  if (claimError) throw new Error(claimError.message ?? String(claimError))
  return claimed
}
