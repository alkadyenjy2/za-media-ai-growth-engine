import { useEffect, useState, type FormEvent } from 'react'
import { Megaphone, Plus } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Campaign, CampaignStatus } from '../types/database'
import { Modal } from '../components/Modal'

const emptyForm = { name: '', objective: 'Lead generation', budget: '0' }

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    const { data, error: loadError } = await supabase.from('campaigns').select('*, companies(name)').order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    setCampaigns((data as Campaign[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const createCampaign = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    const payload = { ...form, budget: Number(form.budget) || 0, status: 'draft' as CampaignStatus }
    const { data, error: saveError } = await supabase.from('campaigns').insert(payload).select().maybeSingle()
    if (saveError) { setError(saveError.message); setSaving(false); return }
    if (supabaseConfigured) await supabase.from('audit_logs').insert({ action: 'campaign_created', entity_type: 'campaign', actor: 'dashboard', details: { id: (data as Campaign | null)?.id ?? 'unknown', name: form.name } })
    setForm(emptyForm); setShowModal(false); await load(); setSaving(false)
  }

  return <div className="animate-fade-in space-y-6">
    <div className="flex items-end justify-between">
      <div><p className="text-sm text-neutral-500">Monitor campaign performance across every channel.</p><div className="mt-3 flex items-center gap-2"><span className="text-2xl font-display font-bold">{campaigns.length}</span><span className="text-sm text-neutral-500">campaigns</span></div></div>
      <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={17}/> New campaign</button>
    </div>
    {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}<button className="ml-2 text-error-500 hover:text-error-700" onClick={() => setError('')}>Dismiss</button></div>}
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {loading ? <div className="card p-8 text-sm text-neutral-400">Loading campaigns...</div>
      : campaigns.map((campaign) => <div className="card p-5" key={campaign.id}>
        <div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Megaphone size={18}/></div><span className={`badge-${campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : 'neutral'}`}>{campaign.status}</span></div>
        <h3 className="mt-4 font-display text-lg">{campaign.name}</h3>
        <p className="mt-1 text-sm text-neutral-500">{campaign.companies?.name ?? 'Unassigned'} · {campaign.objective}</p>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-4"><div><div className="text-lg font-bold">{campaign.leads_count}</div><div className="text-[11px] text-neutral-500">Leads</div></div><div><div className="text-lg font-bold">${Number(campaign.spend).toLocaleString()}</div><div className="text-[11px] text-neutral-500">Spend</div></div><div><div className="text-lg font-bold">${Number(campaign.budget).toLocaleString()}</div><div className="text-[11px] text-neutral-500">Budget</div></div></div>
      </div>)}
      {!loading && campaigns.length === 0 && <div className="card col-span-full flex min-h-[320px] flex-col items-center justify-center text-center"><Megaphone className="mb-3 text-neutral-300" size={32}/><h3 className="font-display text-lg">No campaigns yet</h3><p className="mt-1 text-sm text-neutral-500">Create a campaign to start tracking performance.</p></div>}
    </div>
    {showModal && <Modal title="New campaign" onClose={() => setShowModal(false)}>
      <form onSubmit={createCampaign} className="space-y-4">
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Campaign name *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Objective</label><select className="input" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}><option>Lead generation</option><option>Brand awareness</option><option>Engagement</option><option>Conversions</option></select></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-neutral-600">Budget ($)</label><input type="number" min="0" className="input" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}/></div>
        <div className="flex justify-end gap-3 pt-2"><button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create campaign'}</button></div>
      </form>
    </Modal>}
  </div>
}
