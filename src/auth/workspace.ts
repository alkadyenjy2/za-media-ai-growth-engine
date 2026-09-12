import { supabase } from '../lib/supabase'

const ZA_MEDIA_WORKSPACE_ID = '37996c28-d9f9-4e5c-895d-692b8a1f23e0'

export async function resolveWorkspace() {
  const { data, error } = await supabase.from('workspace_members').select('workspace_id, role').maybeSingle()
  if (error) throw error
  if (data) return data
  const { data: claimed, error: claimError } = await supabase.rpc('claim_unowned_workspace', { target_workspace_id: ZA_MEDIA_WORKSPACE_ID })
  if (claimError) throw new Error(claimError.message ?? String(claimError))
  return claimed
}
