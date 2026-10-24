import { useMemo } from 'react'
import { CheckCircle2, Mail, Send } from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

type OutreachRow = {
  _id: string
  channel: string
  event_type: string
  occurred_at: string
  content?: string
}

export function OutreachPage() {
  // Convex is the canonical data source. The query is reactive and scoped to
  // the authenticated workspace by api.core.list.
  const result = useQuery(api.core.list, { table: 'prospect_outreach_events', limit: 500 })
  const rows = useMemo(() => {
    const events = (result ?? []) as unknown as OutreachRow[]
    return events
      .filter((row) => ['drafted', 'reviewed', 'approved', 'sent', 'replied', 'stopped'].includes(row.event_type))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, 100)
  }, [result])

  const loading = result === undefined
  const drafts = rows.filter((row) => row.event_type === 'drafted' || row.event_type === 'reviewed')
  const approved = rows.filter((row) => row.event_type === 'approved')

  return <div className="animate-fade-in space-y-6">
    <div className="flex items-end justify-between">
      <div>
        <p className="text-sm text-neutral-500">Evidence-backed email outreach with an explicit approval gate.</p>
        <div className="mt-3 flex gap-2 text-xs">
          <span className="badge-neutral">{drafts.length} drafts</span>
          <span className="badge-neutral">{approved.length} approved</span>
        </div>
      </div>
      <span className="text-xs text-neutral-500">Live Convex data</span>
    </div>
    <div role="status" className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
      Production outbound freeze is active. Drafts can be reviewed, but approval and external sending are disabled. Nothing will be sent from this workspace.
    </div>
    <div className="card overflow-hidden">
      <div className="border-b border-neutral-200 p-5">
        <div className="flex items-center gap-2"><Mail size={18}/><h2 className="text-lg">Approval queue</h2></div>
        <p className="mt-1 text-sm text-neutral-500">A draft must be explicitly approved before any external send.</p>
      </div>
      <div className="divide-y divide-neutral-100">
        {loading ? <div className="p-10 text-center text-sm text-neutral-400">Loading…</div>
          : drafts.length === 0 ? <div className="p-10 text-center text-sm text-neutral-400">No drafts waiting for approval.</div>
          : drafts.map((row) => <div key={String(row._id)} className="p-5">
            <div className="text-xs text-neutral-500">{row.channel} · {new Date(row.occurred_at).toLocaleString()}</div>
            <div className="mt-2 whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">{row.content || 'Empty draft'}</div>
            <button className="btn-primary mt-4 inline-flex items-center gap-2" disabled={true} title="Disabled while the production outbound freeze is active">
              <CheckCircle2 size={16}/>Approve
            </button>
          </div>)}
      </div>
    </div>
    <div className="card overflow-hidden">
      <div className="border-b border-neutral-200 p-5">
        <div className="flex items-center gap-2"><Send size={18}/><h2 className="text-lg">Approved — explicit send</h2></div>
        <p className="mt-1 text-sm text-neutral-500">This second action performs the external email send.</p>
      </div>
      <div className="divide-y divide-neutral-100">
        {loading ? <div className="p-10 text-center text-sm text-neutral-400">Loading…</div>
          : approved.length === 0 ? <div className="p-10 text-center text-sm text-neutral-400">No approved email waiting to send.</div>
          : approved.map((row) => <div key={String(row._id)} className="flex items-center justify-between gap-4 p-5">
            <div className="text-sm text-neutral-700">{row.content || 'Approved email'}</div>
            <button className="btn-primary inline-flex shrink-0 items-center gap-2" disabled={true} title="Disabled while the production outbound freeze is active">
              <Send size={15}/>Send email
            </button>
          </div>)}
      </div>
    </div>
  </div>
}
