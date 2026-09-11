import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Lead, LeadStatus } from '../types/database'
import { StatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'

const statuses: (LeadStatus | 'all')[] = ['all','new','contacted','qualified','appointment','won','lost']
const emptyForm = { full_name: '', email: '', phone: '', property_address: '', source: 'Facebook', project_type: 'Roofing', estimated_value: '0' }

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const logAction = async (action: string, details: Record<string, unknown>) => {
    if (!supabaseConfigured) return
    await supabase.from('audit_logs').insert({ action, entity_type: 'lead', actor: 'dashboard', details })
  }

  const load = async () => {
    setLoading(true); setError('')
    const { data, error: loadError } = await supabase.from('leads').select('*, companies(name), social_pages(name)').order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    setLeads((data as Lead[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => leads.filter((lead) => (filter === 'all' || lead.status === filter) && `${lead.full_name} ${lead.email ?? ''} ${lead.phone ?? ''}`.toLowerCase().includes(query.toLowerCase())), [leads, filter, query])

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (lead: Lead) => { setEditingId(lead.id); setForm({ full_name: lead.full_name, email: lead.email ?? '', phone: lead.phone ?? '', property_address: lead.property_address ?? '', source: lead.source, project_type: lead.project_type, estimated_value: String(lead.estimated_value) }); setShowModal(true) }

  const saveLead = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    const payload = { ...form, estimated_value: Number(form.estimated_value) || 0 }
    if (editingId) {
      const { error: saveError } = await supabase.from('leads').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
      if (saveError) { setError(saveError.message); setSaving(false); return }
      await logAction('lead_updated', { id: editingId, name: form.full_name })
    } else {
      const { data, error: saveError } = await supabase.from('leads').insert(payload).select().maybeSingle()
      if (saveError) { setError(saveError.message); setSaving(false); return }
      await logAction('lead_created', { id: (data as Lead | null)?.id ?? 'unknown', name: form.full_name, source: form.source })
    }
    setForm(emptyForm); setShowModal(false); setEditingId(null); await load(); setSaving(false)
  }

  const updateStatus = async (id: string, status: LeadStatus) => {
    const { error: updateError } = await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (updateError) { setError(updateError.message); return }
    await logAction('lead_status_changed', { id, status })
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, status } : lead))
  }

  const deleteLead = async (id: string) => {
    const lead = leads.find((l) => l.id === id)
    const { error: deleteError } = await supabase.from('leads').delete().eq('id', id)
    if (deleteError) { setError(deleteError.message); return }
    await logAction('lead_deleted', { id, name: lead?.full_name ?? 'unknown' })
    setLeads((current) => current.filter((lead) => lead.id !== id))
  }

  return <div className="animate-fade-in space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm text-neutral-500">Manage and qualify every opportunity in one place.</p>
        <div className="mt-3 flex items-center gap-2"><span className="text-2xl font-display font-bold">{leads.length}</span><span className="text-sm text-neutral-500">total leads</span></div>
      </div>
      <button className="btn-primary" onClick={openCreate}><Plus size={17}/> Add lead</button>
    </div>
    {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}<button className="ml-2 text-error-500 hover:text-error-700" onClick={() => setError('')}>Dismiss</button></div>}
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17}/><input className="input pl-9" placeholder="Search leads..." value={query} onChange={(event) => setQuery(event.target.value)}/></div>
        <div className="flex flex-wrap items-center gap-2"><SlidersHorizontal size={16} className="text-neutral-400"/>{statuses.map((status) => <button key={status} onClick={() => setFilter(status)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${filter === status ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>{status}</button>)}</div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500"><tr>
          <th className="px-5 py-3 font-semibold">Lead</th><th className="px-5 py-3 font-semibold">Source</th><th className="px-5 py-3 font-semibold">AI score</th><th className="px-5 py-3 font-semibold">Value</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Created</th><th className="px-5 py-3 font-semibold">Actions</th>
        </tr></thead>
        <tbody className="divide-y divide-neutral-100">
          {loading ? <tr><td colSpan={7} className="px-5 py-12 text-center text-neutral-400">Loading leads...</td></tr>
          : filtered.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-neutral-400">No leads found. Add your first lead to start the pipeline.</td></tr>
          : filtered.map((lead) => <tr key={lead.id} className="group hover:bg-neutral-50">
            <td className="px-5 py-4"><div className="font-semibold text-neutral-800">{lead.full_name}</div><div className="mt-0.5 text-xs text-neutral-500">{lead.email || lead.phone || 'No contact details'}</div></td>
            <td className="px-5 py-4"><div className="text-neutral-700">{lead.source}</div><div className="text-xs text-neutral-400">{lead.project_type}</div></td>
            <td className="px-5 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200"><div className={`h-full rounded-full ${lead.score >= 70 ? 'bg-accent-500' : lead.score >= 40 ? 'bg-warning-500' : 'bg-neutral-400'}`} style={{ width: `${lead.score}%` }}/></div><span className="text-xs font-bold text-neutral-600">{lead.score}</span></div></td>
            <td className="px-5 py-4 font-semibold text-neutral-700">${Number(lead.estimated_value).toLocaleString()}</td>
            <td className="px-5 py-4"><select value={lead.status} onChange={(event) => void updateStatus(lead.id, event.target.value as LeadStatus)} className="cursor-pointer border-0 bg-transparent p-0 text-xs focus:ring-0"><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="appointment">Appointment</option><option value="won">Won</option><option value="lost">Lost</option></select><div className="mt-1"><StatusBadge status={lead.status}/></div></td>
            <td className="px-5 py-4 text-xs text-neutral-500">{new Date(lead.created_at).toLocaleDateString()}</td>
            <td className="px-5 py-4"><div className="flex items-center gap-2"><button onClick={() => openEdit(lead)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><Pencil size={15}/></button><button onClick={() => void deleteLead(lead.id)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-error-50 hover:text-error-600"><Trash2 size={15}/></button></div></td>
          </tr>)}
        </tbody>
      </table></div>
    </div>
    {showModal && <Modal title={editingId ? 'Edit lead' : 'Add new lead'} onClose={() => { setShowModal(false); setEditingId(null) }}>
      <form onSubmit={saveLead} className="space-y-4">
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Full name *</label><input className="input" required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })}/></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Email</label><input type="email" className="input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></div><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Phone</label><input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></div></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Property address</label><input className="input" value={form.property_address} onChange={(event) => setForm({ ...form, property_address: event.target.value })}/></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Source</label><select className="input" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}><option>Facebook</option><option>Instagram</option><option>Google</option><option>Website</option><option>Referral</option></select></div><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Estimated value ($)</label><input type="number" min="0" className="input" value={form.estimated_value} onChange={(event) => setForm({ ...form, estimated_value: event.target.value })}/></div></div>
        <div className="flex justify-end gap-3 pt-2"><button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditingId(null) }}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update lead' : 'Save lead'}</button></div>
      </form>
    </Modal>}
  </div>
}
