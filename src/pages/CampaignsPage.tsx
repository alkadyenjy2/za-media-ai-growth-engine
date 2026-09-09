import { useEffect, useState } from 'react'
import { Megaphone, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Campaign, CampaignStatus } from '../types/database'

const emptyForm = { name: '', objective: '', budget: '0', status: 'draft' as CampaignStatus }

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase.from('campaigns').select('*, companies(name)').order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    setCampaigns((data as Campaign[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const createCampaign = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const { error: saveError } = await supabase.from('campaigns').insert({
      name: form.name.trim(),
      objective: form.objective.trim(),
      budget: Number(form.budget) || 0,
      status: form.status,
      leads_count: 0,
      spend: 0,
    })
    if (saveError) setError(saveError.message)
    else {
      await supabase.from('audit_logs').insert({ action: 'campaign.created', entity_type: 'campaign', actor: 'dashboard', details: { name: form.name.trim() } })
      setForm(emptyForm)
      setShowModal(false)
      await load()
    }
    setSaving(false)
  }

  const updateStatus = async (campaign: Campaign, status: CampaignStatus) => {
    const { error: updateError } = await supabase.from('campaigns').update({ status }).eq('id', campaign.id)
    if (updateError) setError(updateError.message)
    else {
      await supabase.from('audit_logs').insert({ action: 'campaign.status_changed', entity_type: 'campaign', entity_id: campaign.id, actor: 'dashboard', details: { from: campaign.status, to: status } })
      await load()
    }
  }

  return <div className="animate-fade-in space-y-6">
    <div className="flex items-end justify-between">
      <div><p className="text-sm text-neutral-500">Monitor campaign performance across every channel.</p><div className="mt-3 flex items-center gap-2"><span className="text-2xl font-display font-bold">{campaigns.length}</span><span className="text-sm text-neutral-500">campaigns</span></div></div>
      <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={17}/> New campaign</button>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {loading ? <div className="card p-8 text-sm text-neutral-400">Loading campaigns...</div> : campaigns.map((campaign) => <div className="card p-5" key={campaign.id}>
        <div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Megaphone size={18}/></div><select value={campaign.status} onChange={(e) => void updateStatus(campaign, e.target.value as CampaignStatus)} className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"><option value="draft">draft</option><option value="active">active</option><option value="paused">paused</option><option value="completed">completed</option></select></div>
        <h3 className="mt-4 font-display text-lg">{campaign.name}</h3><p className="mt-1 text-sm text-neutral-500">{campaign.companies?.name ?? 'Unassigned'} · {campaign.objective}</p>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-4"><div><div className="text-lg font-bold">{campaign.leads_count}</div><div className="text-[11px] text-neutral-500">Leads</div></div><div><div className="text-lg font-bold">${Number(campaign.spend).toLocaleString()}</div><div className="text-[11px] text-neutral-500">Spend</div></div><div><div className="text-lg font-bold">${Number(campaign.budget).toLocaleString()}</div><div className="text-[11px] text-neutral-500">Budget</div></div></div>
      </div>)}
      {!loading && campaigns.length === 0 && <div className="card col-span-full flex min-h-[320px] flex-col items-center justify-center text-center"><Megaphone className="mb-3 text-neutral-300" size={32}/><h3 className="font-display text-lg">No campaigns yet</h3><p className="mt-1 text-sm text-neutral-500">Create your first campaign to start tracking performance.</p></div>}
    </div>
    {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form onSubmit={createCampaign} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">New campaign</h2><button type="button" onClick={() => setShowModal(false)}><X size={20}/></button></div><div className="mt-5 space-y-4"><input required value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Campaign name" className="input"/><input required value={form.objective} onChange={e => setForm({...form, objective:e.target.value})} placeholder="Objective" className="input"/><input type="number" min="0" step="0.01" value={form.budget} onChange={e => setForm({...form, budget:e.target.value})} placeholder="Budget" className="input"/><select value={form.status} onChange={e => setForm({...form, status:e.target.value as CampaignStatus})} className="input"><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option></select></div><button disabled={saving} className="btn-primary mt-6 w-full">{saving ? 'Creating...' : 'Create campaign'}</button></form></div>}
  </div>
}
