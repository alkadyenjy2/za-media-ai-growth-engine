import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function requireProspectWorkspaceAccess(req: Request, supabase: SupabaseClient, prospectId: string) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Response(JSON.stringify({ ok: false, error: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) throw new Response(JSON.stringify({ ok: false, error: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  const { data: profile, error: profileError } = await supabase.from('prospect_profiles').select('workspace_id').eq('id', prospectId).maybeSingle()
  if (profileError) throw profileError
  if (!profile?.workspace_id) throw new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  const { data: membership, error: membershipError } = await supabase.from('workspace_members').select('workspace_id').eq('workspace_id', profile.workspace_id).eq('user_id', authData.user.id).maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) throw new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  return { userId: authData.user.id, workspaceId: profile.workspace_id as string }
}
