import { useEffect, useState, type FormEvent } from 'react'
import { Building2, Plus } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Company } from '../types/database'
import { Modal } from '../components/Modal'

const emptyCompany = { name: '', industry: 'Roofing', contact_name: '', contact_email: '', contact_phone: '', job_title: '' }

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [companyForm, setCompanyForm] = useState(emptyCompany)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    const { data, error: loadError } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    setCompanies((data as Company[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const createCompany = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    if (!companyForm.contact_name || !companyForm.contact_email || !companyForm.contact_phone || !companyForm.job_title) {
      setError('Contact name, email, phone, and job title are required.'); setSaving(false); return
    }

    const { data: company, error: companyError } = await supabase.from('companies').insert({ name: companyForm.name, industry: companyForm.industry }).select().maybeSingle()
    if (companyError || !company) { setError(companyError?.message ?? 'Company creation failed.'); setSaving(false); return }

    const { data: contact, error: contactError } = await supabase.from('contacts').insert({
      company_id: company.id,
      full_name: companyForm.contact_name,
      email: companyForm.contact_email,
      phone: companyForm.contact_phone,
      job_title: companyForm.job_title,
      is_decision_maker: true,
    }).select().maybeSingle()
    if (contactError || !contact) {
      setError(contactError?.message ?? 'Contact creation failed. The company was created and can be reused.')
      setSaving(false)
      return
    }

    if (supabaseConfigured) {
      await supabase.from('audit_logs').insert([
        { action: 'company.created', entity_type: 'company', entity_id: company.id, actor: 'dashboard', details: { name: companyForm.name } },
        { action: 'contact.created', entity_type: 'contact', entity_id: contact.id, actor: 'dashboard', details: { company_id: company.id, name: companyForm.contact_name } },
      ])
    }
    setCompanyForm(emptyCompany); setShowCompanyModal(false); await load(); setSaving(false)
  }

  return <div className="animate-fade-in space-y-6">
    <p className="text-sm text-neutral-500">Manage the companies powering your operations.</p>
    {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}<button className="ml-2 text-error-500 hover:text-error-700" onClick={() => setError('')}>Dismiss</button></div>}
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-200 p-5"><div><h2 className="text-lg">Companies</h2><p className="mt-1 text-xs text-neutral-500">{companies.length} connected clients</p></div><div className="flex items-center gap-2"><Building2 size={19} className="text-neutral-400"/><button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setShowCompanyModal(true)}><Plus size={14}/> Add</button></div></div>
      <div className="divide-y divide-neutral-100">
        {loading ? <p className="p-8 text-sm text-neutral-400">Loading...</p>
        : companies.map((company) => <div className="flex items-center justify-between p-5" key={company.id}><div><div className="font-semibold text-neutral-800">{company.name}</div><p className="mt-1 text-xs text-neutral-500">{company.industry} · {company.country}</p></div><span className="badge-success">Active</span></div>)}
        {!loading && companies.length === 0 && <p className="p-8 text-center text-sm text-neutral-400">No companies added yet.</p>}
      </div>
    </div>
    {showCompanyModal && <Modal title="Add company" onClose={() => setShowCompanyModal(false)}>
      <form onSubmit={createCompany} className="space-y-4">
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Company name *</label><input className="input" required value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}/></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Industry</label><select className="input" value={companyForm.industry} onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}><option>Roofing</option><option>Solar</option><option>HVAC</option><option>Construction</option><option>Marketing</option><option>Other</option></select></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Contact name *</label><input className="input" required value={companyForm.contact_name} onChange={(e) => setCompanyForm({ ...companyForm, contact_name: e.target.value })}/></div><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Contact email *</label><input type="email" className="input" required value={companyForm.contact_email} onChange={(e) => setCompanyForm({ ...companyForm, contact_email: e.target.value })}/></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Contact phone *</label><input className="input" required value={companyForm.contact_phone} onChange={(e) => setCompanyForm({ ...companyForm, contact_phone: e.target.value })}/></div><div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Job title *</label><input className="input" required value={companyForm.job_title} onChange={(e) => setCompanyForm({ ...companyForm, job_title: e.target.value })}/></div></div>
        <div className="flex justify-end gap-3 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowCompanyModal(false)}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add company'}</button></div>
      </form>
    </Modal>}
  </div>
}
