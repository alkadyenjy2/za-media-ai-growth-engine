import { useEffect, useState } from 'react'
import { Activity, CheckCircle2 } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { AuditLog } from '../types/database'

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    void (async () => {
      const { data, error: loadError } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
      if (loadError) setError(loadError.message)
      setLogs((data as AuditLog[]) ?? [])
      setLoading(false)
    })()
  }, [])
  return <div className="animate-fade-in space-y-6">
    <div><p className="text-sm text-neutral-500">A transparent history of what happened inside your growth engine.</p><div className="mt-3 flex items-center gap-2"><span className="text-2xl font-display font-bold">{logs.length}</span><span className="text-sm text-neutral-500">recent events</span></div></div>
    {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}<button className="ml-2 text-error-500 hover:text-error-700" onClick={() => setError('')}>Dismiss</button></div>}
    <div className="card overflow-hidden">
      <div className="border-b border-neutral-200 p-5"><h2 className="text-lg">System activity</h2></div>
      <div className="divide-y divide-neutral-100">
        {loading ? <p className="p-8 text-sm text-neutral-400">Loading activity...</p>
        : logs.map((log) => <div key={log.id} className="flex items-start gap-4 p-5"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600"><CheckCircle2 size={17}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-neutral-800">{log.action.replace(/_/g, ' ')}</span><span className="badge-neutral">{log.entity_type}</span></div><p className="mt-1 text-xs text-neutral-500">by {log.actor} · {new Date(log.created_at).toLocaleString()}</p></div><Activity size={16} className="text-neutral-300"/></div>)}
        {!loading && logs.length === 0 && <div className="flex min-h-[260px] flex-col items-center justify-center text-center"><Activity className="mb-3 text-neutral-300" size={30}/><p className="text-sm text-neutral-500">{supabaseConfigured ? 'Activity will appear here as the system processes work.' : 'Connect Supabase to track real activity.'}</p></div>}
      </div>
    </div>
  </div>
}
