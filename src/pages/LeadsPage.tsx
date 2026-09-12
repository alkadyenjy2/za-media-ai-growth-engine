import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Brain, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { qualifyLead } from '../lib/ai'
import type { Company, Contact, Lead, LeadSource, LeadStatus, PipelineStage } from '../types/database'
import { StatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'

const statuses: (LeadStatus | 'all')[] = ['all', 'Hot', 'Warm', 'Cold']
const sources: LeadSource[] = ['Web Form', 'LinkedIn Automation', 'Inbound WhatsApp', 'Cold Outreach', 'Meta Ad']
const stages: PipelineStage[] = ['intake', 'qualified', 'discovery', 'proposal', 'closed_won']
const emptyForm = { company_id: '', contact_id: '', email: '', phone: '', source: 'Web Form' as LeadSource, industry: 'Roofing', monthly_budget: '0', estimated_value: '0', stage: 'intake' as PipelineStage, status: 'Warm' as LeadStatus, notes: '' }

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [qualifyingId, setQualifyingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [aiMessage, setAiMessage] = useState('')

  const logAction = async (action: string, entityId: string | null, details: Record<string, unknown>) => {
    if (!supabaseConfigured) return
    await supabase.from('audit_logs').insert({ action, entity_type: 'lead', entity_id: entityId, actor: 'dashboard', details })
  }

  const load = async () => {
    setLoading(true); setError('')
    const [leadsRes, companiesRes, contactsRes] = await Promise.all([
      supabase.from('leads').select('*, companies(name), contacts(full_name, email, phone)').order('created_at', { ascending: false }),
      supabase.from('companies').select('*').order('name'),
      supabase.from('contacts').select('*').order('full_name'),
    ])
    if (leadsRes.error) setError(leadsRes.error.message)
    if (companiesRes.error) setError(companiesRes.error.message)
    if (contactsRes.error) setError(contactsRes.error.message)
    setLeads((leadsRes.data as Lead[]) ?? [])
    setCompanies((companiesRes.data as Company[]) ?? [])
    setContacts((contactsRes.data as Contact[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => leads.filter((lead) => (filter === 'all' || lead.status === filter) && `${lead.contact_name} ${lead.company_name} ${lead.email} ${lead.phone}`.toLowerCase().includes(query.toLowerCase())), [leads, filter, query])
  const formContacts = useMemo(() => contacts.filter((contact) => contact.company_id === form.company_id), [contacts, form.company_id])

  const openCreate = () => { setEditingId(null); setForm({ ...emptyForm, company_id: companies[0]?.id ?? '' }); setShowModal(true) }
  const openEdit = (lead: Lead) => {
    setEditingId(lead.id)
    setForm({ company_id: lead.company_id, contact_id: lead.contact_id, email: lead.email, phone: lead.phone, source: lead.source, industry: lead.industry, monthly_budget: String(lead.monthly_budget), estimated_value: String(lead.estimated_value), stage: lead.stage, status: lead.status, notes: lead.notes ?? '' })
    setShowModal(true)
  }

  const saveLead = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    const company = companies.find((item) => item.id === form.company_id)
    const contact = contacts.find((item) => item.id === form.contact_id)
    if (!company || !contact) { setError('Select a valid company and contact.'); setSaving(false); return }

    const payload = {
      company_id: company.id,
      contact_id: contact.id,
      contact_name: contact.full_name,
      company_name: company.name,
      email: form.email || contact.email,
      phone: form.phone || contact.phone,
      source: form.source,
      industry: form.industry,
      monthly_budget: Number(form.monthly_budget) || 0,
      estimated_value: Number(form.estimated_value) || 0,
      stage: form.stage,
      status: form.status,
      notes: form.notes,
    }

    const result = editingId
      ? await supabase.from('leads').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId).select().maybeSingle()
      : await supabase.from('leads').insert(payload).select().maybeSingle()
    if (result.error || !result.data) { setError(result.error?.message ?? 'Lead save failed.'); setSaving(false); return }

    await logAction(editingId ? 'lead.updated' : 'lead.created', result.data.id, { contact_name: contact.full_name, company_name: company.name, status: form.status, source: form.source })
    setForm(emptyForm); setShowModal(false); setEditingId(null); await load(); setSaving(false)
  }

  const qualify = async (lead: Lead) => {
    setQualifyingId(lead.id); setError(''); setAiMessage('')
    const result = await qualifyLead(lead)
    if (result.error) { setError(`AI qualification failed: ${result.error}`); setQualifyingId(null); return }
    const next: Lead = { ...lead, ai_score: result.score ?? 0, ai_qualification: result.qualification ?? null, ai_reasoning: result.reasoning ?? null, ai_recommended_action: result.recommended_action ?? null, ai_confidence: result.confidence ?? null, ai_evaluated_at: new Date().toISOString() }
    setLeads((current) => current.map((item) => item.id === lead.id ? next : item))
    setAiMessage(`${lead.contact_name}: ${next.ai_score}/100 • ${next.ai_qualification} • ${next.ai_recommended_action}`)
    setQualifyingId(null)
  }

  const updateStatus = async (id: string, status: LeadStatus) => {
    const { error: updateError } = await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (updateError) { setError(updateError.message); return }
    await logAction('lead.status_changed', id, { status })
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, status } : lead))
  }

  const deleteLead = async (id: string) => {
    const lead = leads.find((item) => item.id === id)
    const { error: deleteError } = await supabase.from('leads').delete().eq('id', id)
    if (deleteError) { setError(deleteError.message); return }
    await logAction('lead.deleted', id, { contact_name: lead?.contact_name ?? 'unknown' })
    setLeads((current) => current.filter((item) => item.id !== id))
  }

  return <div className="animate-fade-in space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-sm text-neutral-500">Manage and qualify every opportunity in one place.</p><div className="mt-3 flex items-center gap-2"><span className="text-2xl font-display font-bold">{leads.length}</span><span className="text-sm text-neutral-500">total leads</span></div></div>
      <button className="btn-primary" onClick={openCreate} disabled={companies.length === 0}><Plus size={17}/> Add lead</button>
    </div>
    {companies.length === 0 && !loading && <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">Add a company and contact before creating a lead.</div>}
    {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}<button className="ml-2 text-error-500 hover:text-error-700" onClick={() => setError('')}>Dismiss</button></div>}
    {aiMessage && <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800"><Brain size={16} className="mr-2 inline"/>{aiMessage}</div>}
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17}/><input className="input pl-9" placeholder="Search leads..." value={query} onChange={(event) => setQuery(event.target.value)}/></div>
        <div className="flex flex-wrap items-center gap-2"><SlidersHorizontal size={16} className="text-neutral-400"/>{statuses.map((status) => <button key={status} onClick={() => setFilter(status)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${filter === status ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>{status}</button>)}</div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500"><tr><th className="px-5 py-3 font-semibold">Lead</th><th className="px-5 py-3 font-semibold">Source</th><th className="px-5 py-3 font-semibold">AI score</th><th className="px-5 py-3 font-semibold">Value</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Created</th><th className="px-5 py-3 font-semibold">Actions</th></tr></thead>
        <tbody className="divide-y divide-neutral-100">
          {loading ? <tr><td colSpan={7} className="px-5 py-12 text-center text-neutral-400">Loading leads...</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-neutral-400">No leads found. Add your first lead to start the pipeline.</td></tr> : filtered.map((lead) => <tr key={lead.id} className="group hover:bg-neutral-50">
            <td className="px-5 py-4"><div className="font-semibold text-neutral-800">{lead.contact_name}</div><div className="mt-0.5 text-xs text-neutral-500">{lead.company_name} · {lead.email || lead.phone}</div></td>
            <td className="px-5 py-4"><div className="text-neutral-700">{lead.source}</div><div className="text-xs text-neutral-400">{lead.stage}</div></td>
            <td className="px-5 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200"><div className="h-full rounded-full bg-accent-500" style={{ width: `${Number(lead.ai_score ?? 0)}%` }}/></div><span className="text-xs font-bold text-neutral-600">{lead.ai_score ?? '—'}</span>{lead.ai_qualification && <span className="text-[10px] font-semibold uppercase text-neutral-400">{lead.ai_qualification}</span>}</div></td>
            <td className="px-5 py-4 font-semibold text-neutral-700">${Number(lead.estimated_value).toLocaleString()}</td>
            <td className="px-5 py-4"><select value={lead.status} onChange={(event) => void updateStatus(lead.id, event.target.value as LeadStatus)} className="cursor-pointer border-0 bg-transparent p-0 text-xs focus:ring-0"><option value="Hot">Hot</option><option value="Warm">Warm</option><option value="Cold">Cold</option></select><div className="mt-1"><StatusBadge status={lead.status}/></div></td>
            <td className="px-5 py-4 text-xs text-neutral-500">{new Date(lead.created_at).toLocaleDateString()}</td>
            <td className="px-5 py-4"><div className="flex items-center gap-2"><button onClick={() => void qualify(lead)} disabled={qualifyingId === lead.id || !supabaseConfigured} title={!supabaseConfigured ? 'Connect Supabase to enable AI' : 'Run AI qualification'} className="rounded-lg p-1.5 text-neutral-400 hover:bg-accent-50 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40">{qualifyingId === lead.id ? <span className="text-[10px]">AI…</span> : <Brain size={15}/>}</button><button onClick={() => openEdit(lead)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><Pencil size={15}/></button><button onClick={() => void deleteLead(lead.id)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-error-50 hover:text-error-600"><Trash2 size={15}/></button></div></td>
          </tr>)}
        </tbody></table></div>
    </div>
    {showModal && <Modal title={editingId ? 'Edit lead' : 'Add new lead'} onClose={() => { setShowModal(false); setEditingId(null) }}>
      <form onSubmit={saveLead} className="space-y-4">
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Company *</label><select className="input" required value={form.company_id} onChange={(event) => setForm({ ...form, company_id: event.target.value, contact_id: '' })}><option value="">Select company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Contact *</label><select className="input" required value={form.contact_id} onChange={(event) => { const contact = contacts.find((item) => item.id === event.target.value); setForm({ ...form, contact_id: event.target.value, email: contact?.email ?? '', phone: contact?.phone ?? '' }) }}><option value="">Select contact</option>{formContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name} · {contact.job_title}</option>)}</select></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Email *</label><input type="email" className="input" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></div><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Phone *</label><input className="input" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Source</label><select className="input" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as LeadSource })}>{sources.map((source) => <option key={source}>{source}</option>)}</select></div><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Industry *</label><input className="input" required value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })}/></div></div>
        <div className="grid gap-4 sm:grid-cols-3"><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Monthly budget</label><input type="number" min="0" className="input" value={form.monthly_budget} onChange={(event) => setForm({ ...form, monthly_budget: event.target.value })}/></div><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Estimated value</label><input type="number" min="0" className="input" value={form.estimated_value} onChange={(event) => setForm({ ...form, estimated_value: event.target.value })}/></div><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Stage</label><select className="input" value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as PipelineStage })}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></div></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Notes</label><textarea className="input min-h-20" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></div>
        <div className="flex justify-end gap-3 pt-2"><button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditingId(null) }}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update lead' : 'Save lead'}</button></div>
      </form>
    </Modal>}
  </div>
}
