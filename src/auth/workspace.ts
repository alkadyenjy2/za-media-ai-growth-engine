import { convex } from '../lib/convex'
import { api } from '../../convex/_generated/api'
export async function resolveWorkspace() {
  return await convex.query(api.core.workspace, {})
}



