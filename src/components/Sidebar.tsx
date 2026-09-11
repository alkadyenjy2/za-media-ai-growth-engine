import { Building2, CircleDollarSign, FileClock, LayoutDashboard, MessageSquare, Megaphone, Users, X } from 'lucide-react'
import { supabaseConfigured } from '../lib/supabase'

export type PageKey = 'overview' | 'leads' | 'conversations' | 'campaigns' | 'companies' | 'income' | 'audit'
const items: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'leads', label: 'Leads', icon: Users },
  { key: 'conversations', label: 'Conversations', icon: MessageSquare },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { key: 'companies', label: 'Companies & Pages', icon: Building2 },
  { key: 'income', label: 'Income', icon: CircleDollarSign },
  { key: 'audit', label: 'Activity Log', icon: FileClock },
]

export function Sidebar({ active, onNavigate, open, onClose }: { active: PageKey; onNavigate: (page: PageKey) => void; open: boolean; onClose: () => void }) {
  return <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-neutral-950 text-white transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className="flex h-20 items-center justify-between border-b border-white/10 px-6"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 font-display text-lg font-bold">Z</div><div><div className="font-display font-bold tracking-wide">ZA MEDIA</div><div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">Growth Engine</div></div></div><button onClick={onClose} className="lg:hidden text-neutral-400"><X size={20}/></button></div>
    <nav className="flex-1 space-y-1 p-4">{items.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => { onNavigate(key); onClose() }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${active === key ? 'bg-primary-600 text-white shadow-lg shadow-primary-950/30' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}><Icon size={18} strokeWidth={active === key ? 2.3 : 1.8}/>{label}</button>)}</nav>
    <div className="border-t border-white/10 p-4"><div className="rounded-xl bg-white/5 p-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${supabaseConfigured ? 'animate-pulse bg-accent-400' : 'bg-warning-500'}`}/><span className="text-xs font-medium text-neutral-300">{supabaseConfigured ? 'Production mode' : 'Demo mode'}</span></div><p className="mt-2 text-[11px] leading-4 text-neutral-500">{supabaseConfigured ? 'Connected to live Supabase.' : 'No Supabase configured. Showing demo data.'}</p></div></div>
  </aside>
}
