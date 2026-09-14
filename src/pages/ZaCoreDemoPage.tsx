import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Sparkles } from '../lib/icons'
import { supabase } from '../lib/supabase'
import { qualifyDemoLead, type DemoQualification } from '../lib/demoQualification'
import { trackZaEvent } from '../lib/analytics'

const emptyForm = { full_name: '', email: '', primary_goal: '', phone: '', company: '' }

export function ZaCoreDemoPage({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'demo' | 'live'>('demo')
  const [form, setForm] = useState(emptyForm)
  const [result, setResult] = useState<DemoQualification | null>(null)
  const [liveSubmitted, setLiveSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formStarted = useRef(false)

  useEffect(() => {
    trackZaEvent('demo_open')
  }, [])

  const updateField = (field: keyof typeof emptyForm, value: string) => {
    if (!formStarted.current) {
      formStarted.current = true
      trackZaEvent('form_started')
    }
    setForm(current => ({ ...current, [field]: value }))
  }

  const resetDemo = () => {
    formStarted.current = false
    setMode('demo')
    setForm(emptyForm)
    setResult(null)
    setLiveSubmitted(false)
    setSaving(false)
    setError('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    if (mode === 'demo') {
      setResult(qualifyDemoLead(form))
      trackZaEvent('form_submitted')
      trackZaEvent('demo_step_completed')
      setSaving(false)
      return
    }
    const { error: saveError } = await supabase.from('leads').insert({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      source: 'Website',
      project_type: 'Marketing Strategy & Planning',
      estimated_value: 0,
      status: 'new',
      score: 50,
    })
    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }
    await supabase.from('audit_logs').insert({
      action: 'marketing_plan_requested',
      entity_type: 'lead',
      actor: 'website',
      details: { source: 'core_demo', name: form.full_name, company: form.company, primary_goal: form.primary_goal, requested_service: 'Marketing Strategy & Planning', mode: 'live' },
    })
    setLiveSubmitted(true)
    trackZaEvent('form_submitted')
    setSaving(false)
  }

  const completed = mode === 'demo' ? Boolean(result) : liveSubmitted

  return <div className="min-h-screen bg-neutral-950 px-4 py-10 text-white sm:px-8">
    <div className="mx-auto max-w-3xl">
      <button onClick={onBack} className="mb-8 text-sm text-neutral-400 hover:text-white">← Back to ZA Media</button>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-300"><Sparkles size={13}/> Core demo</div>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Build my growth plan</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">Marketing request → lead intake → transparent qualification → recommended next action.</p>
          </div>
          <span className="rounded-full border border-accent-400/20 bg-accent-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-300">{mode === 'demo' ? 'Demo Mode' : 'Live Mode'}</span>
        </div>

        {!completed ? <>
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button type="button" onClick={() => { setMode('demo'); setError('') }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === 'demo' ? 'bg-primary-500/20 text-primary-200' : 'text-neutral-500 hover:text-neutral-300'}`}>Demo Mode</button>
            <button type="button" onClick={() => { setMode('live'); setError('') }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === 'live' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Live Mode</button>
          </div>
          <p className="mb-6 text-xs leading-5 text-neutral-500">{mode === 'demo' ? 'Clearly labeled demo data. No real lead, message, booking, payment, or external action is created.' : 'Saves a real Lead. No external action is triggered automatically.'}</p>
          <form onSubmit={submit} className="space-y-4">
            <input className="input bg-white/5 border-white/10 text-white" required placeholder="Full name *" value={form.full_name} onChange={e => updateField('full_name', e.target.value)}/>
            <input type="email" className="input bg-white/5 border-white/10 text-white" required placeholder="Email *" value={form.email} onChange={e => updateField('email', e.target.value)}/>
            <input className="input bg-white/5 border-white/10 text-white" required placeholder="Primary growth goal *" value={form.primary_goal} onChange={e => updateField('primary_goal', e.target.value)}/>
            <div className="grid gap-4 sm:grid-cols-2">
              <input className="input bg-white/5 border-white/10 text-white" placeholder="Phone" value={form.phone} onChange={e => updateField('phone', e.target.value)}/>
              <input className="input bg-white/5 border-white/10 text-white" placeholder="Company name" value={form.company} onChange={e => updateField('company', e.target.value)}/>
            </div>
            {error && <p className="text-sm text-error-400">{error}</p>}
            <button className="btn-primary w-full" disabled={saving}>{saving ? 'Processing…' : mode === 'demo' ? 'Run demo qualification' : 'Submit live request'} <ArrowRight size={17}/></button>
          </form>
        </> : <div>
          <div className="rounded-2xl border border-accent-400/20 bg-accent-400/10 p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-300">Lead intake confirmation</div>
            <p className="mt-2 text-sm text-neutral-200">{mode === 'demo' ? 'Demo request received. No external action was executed.' : 'Live request saved as a real Lead. No external action was executed automatically.'}</p>
          </div>
          {result ? <div className="mt-5 rounded-2xl border border-primary-500/20 bg-primary-500/10 p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-300">Demo qualification result</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div><div className="text-xs text-neutral-500">Priority</div><div className="mt-1 font-semibold">{result.priority}</div></div>
              <div><div className="text-xs text-neutral-500">Lead type</div><div className="mt-1 font-semibold">{result.leadType}</div></div>
              <div><div className="text-xs text-neutral-500">Status</div><div className="mt-1 font-semibold">Ready for review</div></div>
            </div>
            <div className="mt-5"><div className="text-xs text-neutral-500">Recommended next action</div><div className="mt-1 text-sm leading-6 text-neutral-200">{result.nextAction}</div></div>
          </div> : <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-neutral-300">Live intake complete. The existing Leads workspace remains the operational proof surface; no new CRM or dashboard was created.</div>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button onClick={resetDemo} className="btn-primary flex-1">Reset demo</button><button onClick={onBack} className="btn-secondary flex-1">Back to ZA Media</button></div>
        </div>}
      </div>
    </div>
  </div>
}
