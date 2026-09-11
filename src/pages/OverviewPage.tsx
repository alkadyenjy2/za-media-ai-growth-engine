import { useEffect, useState } from 'react'
import { ArrowUpRight, CircleDollarSign, MessageSquare, Target, Users, Brain, Sparkles } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { runGrowthAudit } from '../lib/ai'
import type { Lead } from '../types/database'

const statConfig = [{ key: 'leads', label: 'Total leads', icon: Users, color: 'bg-primary-50 text-primary-600' }, { key: 'qualified', label: 'Qualified leads', icon: Target, color: 'bg-accent-50 text-accent-600' }, { key: 'conversations', label: 'Open conversations', icon: MessageSquare, color: 'bg-warning-50 text-warning-600' }, { key: 'revenue', label: 'Paid revenue', icon: CircleDollarSign, color: 'bg-neutral-100 text-neutral-700' }]

type GrowthAudit = {
  overall_score: number
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  recommended_actions: string[]
  priority: string
}

export function OverviewPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [conversationCount, setConversationCount] = useState(0)
  const [revenue, setRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(false)
  const [audit, setAudit] = useState<GrowthAudit | null>(null)
  const [error, setError] = useState('')
  const [auditMessage, setAuditMessage] = useState('')

  useEffect(() => {
    void (async () => {
      const [leadRes, conversationRes, incomeRes] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('income_records').select('amount').eq('status', 'paid'),
      ])
      if (leadRes.error) setError(leadRes.error.message)
      setLeads((leadRes.data as Lead[]) ?? [])
      setConversationCount(conversationRes.count ?? 0)
      setRevenue((incomeRes.data ?? []).reduce((sum: number, item: { amount: number }) => sum + Number(item.amount), 0))
      setLoading(false)
    })()
  }, [])

  const qualified = leads.filter((lead) => ['qualified', 'appointment', 'won'].includes(lead.status)).length
  const values: Record<string, string> = { leads: String(leads.length), qualified: String(qualified), conversations: String(conversationCount), revenue: `$${revenue.toLocaleString()}` }
  const pipeline = ['new', 'contacted', 'qualified', 'appointment', 'won', 'lost'].map((status) => ({ status, count: leads.filter((lead) => lead.status === status).length }))

  const runAudit = async () => {
    setAuditLoading(true)
    setAuditMessage('')
    const result = await runGrowthAudit({
      data: {
        total_leads: leads.length,
        qualified_leads: qualified,
        open_conversations: conversationCount,
        paid_revenue: revenue,
        pipeline,
      },
    })
    if (result.error) {
      setAuditMessage(result.error.message)
      setAuditLoading(false)
      return
    }
    setAudit(result.data?.result ?? null)
    setAuditMessage(result.data ? 'Growth audit completed and saved.' : 'No audit result returned.')
    setAuditLoading(false)
  }

  return <div className="animate-fade-in space-y-7">
    <div className="flex items-center justify-between"><p className="text-sm text-neutral-500">A clear view of your growth engine, updated from live data.</p><span className={`badge-${supabaseConfigured ? 'success' : 'warning'}`}>{supabaseConfigured ? 'Production' : 'Demo'}</span></div>
    {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}<button className="ml-2 text-error-500 hover:text-error-700" onClick={() => setError('')}>Dismiss</button></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{statConfig.map(({ key, label, icon: Icon, color }) => <div className="card p-5" key={key}><div className="flex items-start justify-between"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={19}/></div><ArrowUpRight size={16} className="text-neutral-300"/></div><div className="mt-5 text-2xl font-display font-bold">{loading ? '—' : values[key]}</div><div className="mt-1 text-sm text-neutral-500">{label}</div></div>)}</div>

    <div className="card overflow-hidden p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-2"><Brain size={19} className="text-primary-600"/><h2 className="text-lg">AI Growth Audit</h2></div><p className="mt-1 text-sm text-neutral-500">Run a factual diagnostic against the current engine data.</p></div>
        <button className="btn-primary inline-flex items-center justify-center gap-2" onClick={() => void runAudit()} disabled={!supabaseConfigured || auditLoading}><Sparkles size={16}/>{auditLoading ? 'Analyzing...' : 'Run AI audit'}</button>
      </div>
      {auditMessage && <div className={`mt-4 rounded-lg px-3 py-2 text-sm ${audit?.overall_score !== undefined ? 'bg-accent-50 text-accent-700' : 'bg-warning-50 text-warning-700'}`}>{auditMessage}</div>}
      {!audit && !auditMessage && <div className="mt-5 rounded-xl bg-neutral-50 p-5 text-sm text-neutral-500">{supabaseConfigured ? 'Run the audit to get an AI-generated score, friction points, opportunities, and recommended actions.' : 'Connect Supabase to enable the live AI Growth Audit.'}</div>}
      {audit && <div className="mt-6 grid gap-5 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 p-4"><div className="text-xs uppercase tracking-wide text-neutral-400">Overall score</div><div className="mt-2 text-4xl font-display font-bold">{audit.overall_score}</div><span className="badge-neutral mt-2 inline-flex">Priority: {audit.priority}</span></div>
        <div className="rounded-xl border border-neutral-200 p-4"><div className="text-sm font-semibold">Strengths</div><ul className="mt-2 space-y-1 text-sm text-neutral-600">{audit.strengths.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}</ul></div>
        <div className="rounded-xl border border-neutral-200 p-4"><div className="text-sm font-semibold">Friction points</div><ul className="mt-2 space-y-1 text-sm text-neutral-600">{audit.weaknesses.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}</ul></div>
        <div className="rounded-xl border border-neutral-200 p-4"><div className="text-sm font-semibold">Opportunities</div><ul className="mt-2 space-y-1 text-sm text-neutral-600">{audit.opportunities.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}</ul></div>
      </div>}
    </div>

    <div className="grid gap-6 xl:grid-cols-5">
      <div className="card p-6 xl:col-span-3"><div className="flex items-center justify-between"><div><h2 className="text-lg">Pipeline health</h2><p className="mt-1 text-sm text-neutral-500">Lead distribution by stage</p></div><span className="badge-success">Live</span></div><div className="mt-7 space-y-4">{pipeline.map(({ status, count }) => <div key={status}><div className="mb-1.5 flex justify-between text-sm"><span className="capitalize text-neutral-600">{status}</span><span className="font-semibold text-neutral-800">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className={`h-full rounded-full ${status === 'won' ? 'bg-accent-500' : status === 'lost' ? 'bg-error-400' : 'bg-primary-500'}`} style={{ width: `${leads.length ? Math.max((count / leads.length) * 100, count ? 4 : 0) : 0}%` }}/></div></div>)}</div></div>
      <div className="card p-6 xl:col-span-2"><h2 className="text-lg">Recent leads</h2><p className="mt-1 text-sm text-neutral-500">Latest opportunities entering the system</p><div className="mt-5 divide-y divide-neutral-100">{leads.slice(0, 5).map((lead) => <div key={lead.id} className="flex items-center justify-between py-3"><div><div className="text-sm font-semibold text-neutral-800">{lead.full_name}</div><div className="text-xs text-neutral-500">{lead.source} · {new Date(lead.created_at).toLocaleDateString()}</div></div><span className="text-sm font-bold text-neutral-700">${Number(lead.estimated_value).toLocaleString()}</span></div>)}{!loading && leads.length === 0 && <div className="py-8 text-center text-sm text-neutral-400">Your recent leads will appear here.</div>}</div></div>
    </div>
  </div>
}
