import { useEffect, useState, type FormEvent } from 'react'
import { Building2, Globe2, Plus } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Company, SocialPage } from '../types/database'
import { Modal } from '../components/Modal'

const emptyCompany = { name: '', industry: 'Roofing', contact_name: '', contact_email: '', contact_phone: '', job_title: '' }
const emptyPage = { name: '', platform: 'Facebook', handle: '', followers: '0' }

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [pages, setPages] = useState<SocialPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [showPageModal, setShowPageModal] = useState(false)
  const [companyForm, setCompanyForm] = useState(emptyCompany)
  const [pageForm, setPageForm] = useState(emptyPage)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    const [companiesRes, pagesRes] = await Promise.all([supabase.from('companies').select('*').order('created_at', { ascending: false }), supabase.from('social_pages').select('*, companies(name)').order('created_at', { ascending: false })])
    if (companiesRes.error) setError(companiesRes.error.message)
    setCompanies((companiesRes.data as Company[]) ?? [])
    setPages((pagesRes.data as SocialPage[]) ?? [])
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

  const createPage = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    const companyId = companies[0]?.id
    if (!companyId) { setError('Add a company before connecting a social page.'); setSaving(false); return }
    const payload = { ...pageForm, company_id: companyId, followers: Number(pageForm.followers) || 0 }
    const { data, error: saveError } = await supabase.from('social_pages').insert(payload).select().maybeSingle()
    if (saveError) { setError(saveError.message); setSaving(false); return }
    if (supabaseConfigured) await supabase.from('audit_logs').insert({ action: 'page.created', entity_type: 'social_page', entity_id: (data as SocialPage | null)?.id ?? null, actor: 'dashboard', details: { name: pageForm.name } })
    setPageForm(emptyPage); setShowPageModal(false); await load(); setSaving(false)
  }

  return <div className="animate-fade-in space-y-6">
    <p className="text-sm text-neutral-500">Manage the companies and social channels powering your operations.</p>
    {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}<button className="ml-2 text-error-500 hover:text-error-700" onClick={() => setError('')}>Dismiss</button></div>}
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-200 p-5"><div><h2 className="text-lg">Companies</h2><p className="mt-1 text-xs text-neutral-500">{companies.length} connected clients</p></div><div className="flex items-center gap-2"><Building2 size={19} className="text-neutral-400"/><button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setShowCompanyModal(true)}><Plus size={14}/> Add</button></div></div>
        <div className="divide-y divide-neutral-100">
          {loading ? <p className="p-8 text-sm text-neutral-400">Loading...</p>
          : companies.map((company) => <div className="flex items-center justify-between p-5" key={company.id}><div><div className="font-semibold text-neutral-800">{company.name}</div><p className="mt-1 text-xs text-neutral-500">{company.industry} · {company.country}</p></div><span className="badge-success">Active</span></div>)}
          {!loading && companies.length === 0 && <p className="p-8 text-center text-sm text-neutral-400">No companies added yet.</p>}
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-200 p-5"><div><h2 className="text-lg">Social pages</h2><p className="mt-1 text-xs text-neutral-500">{pages.length} connected channels</p></div><div className="flex items-center gap-2"><Globe2 size={19} className="text-neutral-400"/><button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setShowPageModal(true)} disabled={companies.length === 0}><Plus size={14}/> Add</button></div></div>
        <div className="divide-y divide-neutral-100">
          {loading ? <p className="p-8 text-sm text-neutral-400">Loading...</p>
          : pages.map((page) => <div className="flex items-center justify-between p-5" key={page.id}><div><div className="font-semibold text-neutral-800">{page.name}</div><p className="mt-1 text-xs text-neutral-500">{page.companies?.name || 'Unassigned'} · {page.platform} · {page.followers.toLocaleString()} followers</p></div><span className={page.status === 'connected' ? 'badge-success' : 'badge-warning'}>{page.status}</span></div>)}
          {!loading && pages.length === 0 && <p className="p-8 text-center text-sm text-neutral-400">{companies.length === 0 ? 'Add a company first, then connect a social page.' : 'No social pages connected yet.'}</p>}
        </div>
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
    {showPageModal && <Modal title="Add social page" onClose={() => setShowPageModal(false)}>
      <form onSubmit={createPage} className="space-y-4">
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Page name *</label><input className="input" required value={pageForm.name} onChange={(e) => setPageForm({ ...pageForm, name: e.target.value })}/></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Platform</label><select className="input" value={pageForm.platform} onChange={(e) => setPageForm({ ...pageForm, platform: e.target.value })}><option>Facebook</option><option>Instagram</option><option>Google</option><option>Website</option><option>Other</option></select></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Handle / URL</label><input className="input" value={pageForm.handle} onChange={(e) => setPageForm({ ...pageForm, handle: e.target.value })}/></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Followers</label><input type="number" min="0" className="input" value={pageForm.followers} onChange={(e) => setPageForm({ ...pageForm, followers: e.target.value })}/></div>
        <div className="flex justify-end gap-3 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowPageModal(false)}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add page'}</button></div>
      </form>
    </Modal>}
  </div>
}
