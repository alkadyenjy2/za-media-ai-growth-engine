import { ArrowRight, Brain, ChartLine, Clock, Search, Sparkles, Target, TrendingUp, Users, Zap } from '../lib/icons'
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

const problems = [
  { icon: Users, title: 'Leads falling through the cracks', desc: 'Prospects contact you but nobody follows up in time.' },
  { icon: Clock, title: 'Manual follow-ups', desc: 'Your team wastes hours on repetitive outreach instead of closing deals.' },
  { icon: ChartLine, title: 'No visibility into performance', desc: 'You cannot tell which campaigns actually generate revenue.' },
  { icon: Search, title: 'Weak digital presence', desc: 'Your website and social channels do not convert visitors into customers.' },
]

const services = [
  { icon: Search, title: 'AI Growth Audits', desc: 'Analyze digital presence, identify gaps, and surface opportunities automatically.' },
  { icon: Users, title: 'Lead Generation', desc: 'Capture prospects from ads, social, and your website into one unified pipeline.' },
  { icon: Target, title: 'Lead Qualification', desc: 'AI scores and categorizes every lead so your team focuses on the right ones.' },
  { icon: Zap, title: 'Marketing Automation', desc: 'Trigger follow-up sequences, schedule outreach, and nurture leads on autopilot.' },
  { icon: Brain, title: 'AI Operations', desc: 'Decision intelligence that turns raw data into recommended next actions.' },
  { icon: TrendingUp, title: 'Growth Analytics', desc: 'Track pipeline, conversion, and revenue in a single live dashboard.' },
]

const steps = [
  { num: '01', title: 'Audit', desc: 'We analyze your current marketing, website, and lead flow.' },
  { num: '02', title: 'Identify', desc: 'AI surfaces problems and opportunities with clear recommendations.' },
  { num: '03', title: 'Automate', desc: 'We build the workflows that handle follow-ups and outreach.' },
  { num: '04', title: 'Execute', desc: 'The system runs your growth engine 24/7 without manual work.' },
  { num: '05', title: 'Measure', desc: 'Track revenue, pipeline, and performance in real time.' },
]

export function LandingPage({ onEnterDashboard }: { onEnterDashboard: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', company: '' })
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    const { error: saveError } = await supabase.from('leads').insert({
      full_name: form.full_name, email: form.email, phone: form.phone, source: 'Website',
      project_type: 'Growth Audit', estimated_value: 0, status: 'new', score: 50,
    })
    if (saveError) { setError(saveError.message); setSaving(false); return }
    await supabase.from('audit_logs').insert({ action: 'lead_created', entity_type: 'lead', actor: 'website', details: { source: 'landing_page', name: form.full_name, company: form.company } })
    setSubmitted(true); setSaving(false)
  }

  return <div className="min-h-screen bg-neutral-950 text-white">
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-neutral-950/80 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 font-display text-base font-bold">Z</div><span className="font-display text-lg font-bold tracking-wide">ZA Media</span></div><div className="hidden items-center gap-8 md:flex"><a href="#problem" className="text-sm text-neutral-400 hover:text-white transition-colors">Problem</a><a href="#solution" className="text-sm text-neutral-400 hover:text-white transition-colors">Solution</a><a href="#services" className="text-sm text-neutral-400 hover:text-white transition-colors">Services</a><a href="#how" className="text-sm text-neutral-400 hover:text-white transition-colors">How it works</a></div><button onClick={onEnterDashboard} className="btn bg-white/10 text-white hover:bg-white/20">Dashboard <ArrowRight size={15}/></button></div></nav>

    <section className="relative overflow-hidden pt-32 pb-20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 via-transparent to-accent-600/10"/>
      <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-primary-600/20 blur-3xl"/>
      <div className="absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-accent-600/15 blur-3xl"/>
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-neutral-300"><Sparkles size={15} className="text-primary-400"/> AI-powered growth systems</div>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Turn leads into revenue<br/>with <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">AI-driven growth</span> automation</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-neutral-400">ZA Media helps businesses generate, manage, and convert more opportunities — combining AI, marketing automation, and operations into one growth engine.</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"><button onClick={() => setShowForm(true)} className="btn-primary text-base">Get your AI growth audit <ArrowRight size={18}/></button><button onClick={onEnterDashboard} className="btn bg-white/10 text-white hover:bg-white/20 text-base">View dashboard</button></div>
      </div>
    </section>

    <section id="problem" className="border-t border-white/10 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-12 text-center"><h2 className="font-display text-3xl font-bold sm:text-4xl">The growth problem</h2><p className="mt-3 text-neutral-400">Most businesses lose opportunities without even knowing it.</p></div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{problems.map(({ icon: Icon, title, desc }) => <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-white/20"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-error-500/15 text-error-400"><Icon size={20}/></div><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-400">{desc}</p></div>)}</div>
      </div>
    </section>

    <section id="solution" className="border-t border-white/10 bg-gradient-to-b from-neutral-950 to-neutral-900 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-12 text-center"><h2 className="font-display text-3xl font-bold sm:text-4xl">One system. <span className="text-primary-400">Total growth.</span></h2><p className="mt-3 text-neutral-400">AI + Marketing + Automation + Operations + Analytics in a single platform.</p></div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{services.map(({ icon: Icon, title, desc }) => <div key={title} className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:border-primary-500/30 hover:bg-white/[0.07]"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/15 text-primary-400 transition-colors group-hover:bg-primary-500/25"><Icon size={20}/></div><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-400">{desc}</p></div>)}</div>
      </div>
    </section>

    <section id="how" className="border-t border-white/10 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-12 text-center"><h2 className="font-display text-3xl font-bold sm:text-4xl">How it works</h2><p className="mt-3 text-neutral-400">From audit to revenue in five steps.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{steps.map(({ num, title, desc }) => <div key={num} className="relative rounded-2xl border border-white/10 bg-white/5 p-6"><div className="font-display text-3xl font-bold text-primary-500/40">{num}</div><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1.5 text-sm leading-6 text-neutral-400">{desc}</p></div>)}</div>
      </div>
    </section>

    <section className="border-t border-white/10 bg-gradient-to-b from-neutral-900 to-neutral-950 py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-8">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Ready to grow?</h2>
        <p className="mt-3 text-neutral-400">Get a free AI growth audit. We will analyze your digital presence and show you exactly where opportunities are hiding.</p>
        <button onClick={() => setShowForm(true)} className="btn-primary mt-8 text-base">Request your AI growth audit <ArrowRight size={18}/></button>
      </div>
    </section>

    <footer className="border-t border-white/10 py-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-8"><div className="flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500 font-display text-sm font-bold">Z</div><span className="font-display font-bold">ZA Media</span></div><p className="text-sm text-neutral-500">AI Growth Engine — Built for revenue.</p></div></footer>

    {showForm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4 backdrop-blur-sm" onMouseDown={() => setShowForm(false)}>
        <div className="w-full max-w-md animate-slide-up rounded-2xl border border-white/10 bg-neutral-900 p-8 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
          {submitted ? (
            <div className="text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-500/20 text-accent-400"><Sparkles size={28}/></div><h3 className="font-display text-xl font-bold">Audit requested!</h3><p className="mt-2 text-sm text-neutral-400">We will analyze your digital presence and reach out within 24 hours.</p><button onClick={() => { setShowForm(false); setSubmitted(false); setForm({ full_name: '', email: '', phone: '', company: '' }) }} className="btn-secondary mt-6 w-full">Done</button></div>
          ) : (
            <><div className="mb-6"><h3 className="font-display text-xl font-bold">Get your AI growth audit</h3><p className="mt-1 text-sm text-neutral-400">Free analysis of your digital presence and growth opportunities.</p></div>
            <form onSubmit={submit} className="space-y-4">
              <div><label className="mb-1.5 block text-xs font-semibold text-neutral-400">Full name *</label><input className="input bg-white/5 border-white/10 text-white placeholder:text-neutral-600" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}/></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-neutral-400">Email *</label><input type="email" className="input bg-white/5 border-white/10 text-white placeholder:text-neutral-600" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-neutral-400">Phone</label><input className="input bg-white/5 border-white/10 text-white placeholder:text-neutral-600" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}/></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-neutral-400">Company name</label><input className="input bg-white/5 border-white/10 text-white placeholder:text-neutral-600" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}/></div>
              {error && <p className="text-sm text-error-400">{error}</p>}
              <button className="btn-primary w-full" disabled={saving}>{saving ? 'Submitting...' : 'Request audit'}</button>
            </form>
            </>
          )}
        </div>
      </div>
    )}
  </div>
}
