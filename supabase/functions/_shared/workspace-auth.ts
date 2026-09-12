import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

function unauthorized(status: 401 | 403, message: string) { return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { 'Content-Type': 'application/json' } }) }

export async function requireUserWorkspace(req: Request, supabase: SupabaseClient) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw unauthorized(401, 'Authentication required')
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) throw unauthorized(401, 'Authentication required')
  const { data: membership, error: membershipError } = await supabase.from('workspace_members').select('workspace_id,role').eq('user_id', authData.user.id).maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) throw unauthorized(403, 'Unauthorized')
  return { userId: authData.user.id, workspaceId: membership.workspace_id as string, role: membership.role as string }
}

export async function requireProspectWorkspaceAccess(req: Request, supabase: SupabaseClient, prospectId: string) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw unauthorized(401, 'Authentication required')
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) throw unauthorized(401, 'Authentication required')
  const { data: profile, error: profileError } = await supabase.from('prospect_profiles').select('workspace_id').eq('id', prospectId).maybeSingle()
  if (profileError) throw profileError
  if (!profile?.workspace_id) throw unauthorized(403, 'Unauthorized')
  const { data: membership, error: membershipError } = await supabase.from('workspace_members').select('workspace_id').eq('workspace_id', profile.workspace_id).eq('user_id', authData.user.id).maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) throw unauthorized(403, 'Unauthorized')
  return { userId: authData.user.id, workspaceId: profile.workspace_id as string }
}
