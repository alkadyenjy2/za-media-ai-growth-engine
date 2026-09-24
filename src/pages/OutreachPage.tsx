import { useEffect, useState } from 'react'
import { CheckCircle2, Mail, RefreshCw, Send } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { ProspectOutreachEvent } from '../types/database'

export function OutreachPage() {
  const [rows, setRows] = useState<ProspectOutreachEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const load = async () => {
    setLoading(true); setError('')
    const result = await supabase.from('prospect_outreach_events').select('*').in('event_type', ['drafted', 'reviewed', 'approved', 'sent', 'replied', 'stopped']).order('occurred_at', { ascending: false }).limit(100)
    if (result.error) setError(result.error.message)
    setRows((result.data as ProspectOutreachEvent[]) || [])
    setLoading(false)
  }
  useEffect(() => { if (supabaseConfigured) void load(); else setLoading(false) }, [])
  const drafts = rows.filter((row) => row.event_type === 'drafted' || row.event_type === 'reviewed')
  const approved = rows.filter((row) => row.event_type === 'approved')
  const approve = async (id: string) => {
    setBusyId(id); setError(''); setMessage('')
    const result = await supabase.functions.invoke('outreach-approve', { body: { outreach_event_id: id, reason: 'Approved from ZA Media Outreach workspace' } })
    if (result.error || !result.data?.ok) setError(result.error?.message || result.data?.error || 'Approval failed')
    else setMessage('Draft approved and ready for explicit sending.')
    setBusyId(null); if (!result.error && result.data?.ok) await load()
  }
  const send = async (id: string) => {
    setBusyId(id); setError(''); setMessage('')
    const result = await supabase.functions.invoke('outreach-send', { body: { outreach_event_id: id } })
    if (result.error || !result.data?.ok) setError(result.error?.message || result.data?.reason || result.data?.error || 'Send failed')
    else setMessage('Email sent through AgentMail and recorded.')
    setBusyId(null); if (!result.error && result.data?.ok) await load()
  }
  return <div className="animate-fade-in space-y-6">
    <div className="flex items-end justify-between"><div><p className="text-sm text-neutral-500">Evidence-backed email outreach with an explicit approval gate.</p><div className="mt-3 flex gap-2 text-xs"><span className="badge-neutral">{drafts.length} drafts</span><span className="badge-neutral">{approved.length} approved</span></div></div><button className="btn-secondary inline-flex items-center gap-2" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>Refresh</button></div>
    {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}
    {message && <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">{message}</div>}
    <div className="card overflow-hidden"><div className="border-b border-neutral-200 p-5"><div className="flex items-center gap-2"><Mail size={18}/><h2 className="text-lg">Approval queue</h2></div><p className="mt-1 text-sm text-neutral-500">A draft must be explicitly approved before any external send.</p></div><div className="divide-y divide-neutral-100">{loading ? <div className="p-10 text-center text-sm text-neutral-400">Loading…</div> : drafts.length === 0 ? <div className="p-10 text-center text-sm text-neutral-400">No drafts waiting for approval.</div> : drafts.map((row) => <div key={row.id} className="p-5"><div className="text-xs text-neutral-500">{row.channel} · {new Date(row.occurred_at).toLocaleString()}</div><div className="mt-2 whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">{row.content || 'Empty draft'}</div><button className="btn-primary mt-4 inline-flex items-center gap-2" onClick={() => void approve(row.id)} disabled={busyId === row.id || row.channel !== 'email'}><CheckCircle2 size={16}/>{busyId === row.id ? 'Approving…' : 'Approve'}</button></div>)}</div></div>
    <div className="card overflow-hidden"><div className="border-b border-neutral-200 p-5"><div className="flex items-center gap-2"><Send size={18}/><h2 className="text-lg">Approved — explicit send</h2></div><p className="mt-1 text-sm text-neutral-500">This second action performs the external email send.</p></div><div className="divide-y divide-neutral-100">{approved.length === 0 ? <div className="p-10 text-center text-sm text-neutral-400">No approved email waiting to send.</div> : approved.map((row) => <div key={row.id} className="flex items-center justify-between gap-4 p-5"><div className="text-sm text-neutral-700">{row.content || 'Approved email'}</div><button className="btn-primary inline-flex shrink-0 items-center gap-2" onClick={() => void send(row.id)} disabled={busyId === row.id}><Send size={15}/>{busyId === row.id ? 'Sending…' : 'Send email'}</button></div>)}</div></div>
  </div>
}
