import { useState, type ReactNode } from 'react'
import { Bell, LogOut, Menu, Search } from 'lucide-react'
import { Sidebar, type PageKey } from './Sidebar'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

const titles: Record<PageKey, string> = { overview: 'Operations overview', leads: 'Lead pipeline', conversations: 'Conversations', campaigns: 'Campaign manager', companies: 'Companies & pages', income: 'Income tracking', audit: 'Activity log' }

export function Layout({ active, onNavigate, children }: { active: PageKey; onNavigate: (page: PageKey) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  return <div className="flex min-h-screen bg-neutral-50"><Sidebar active={active} onNavigate={onNavigate} open={open} onClose={() => setOpen(false)}/><main className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-8"><div className="flex items-center gap-3"><button className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden" onClick={() => setOpen(true)}><Menu size={21}/></button><div><h1 className="text-xl font-semibold text-neutral-900 sm:text-2xl">{titles[active]}</h1><p className="hidden text-xs text-neutral-500 sm:block">ZA Media · {supabaseConfigured ? 'Live workspace' : 'Unavailable'}</p></div></div><div className="flex items-center gap-2 sm:gap-4"><div className="flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-700"><span className="h-1.5 w-1.5 rounded-full bg-accent-500"/>Production</div><button className="hidden rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 sm:block"><Search size={19}/></button><button className="relative rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><Bell size={19}/><span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary-500 ring-2 ring-white"/></button><div className="hidden h-8 w-px bg-neutral-200 sm:block"/><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">ZA</div><span className="hidden max-w-36 truncate text-sm font-medium text-neutral-700 sm:block">{user?.email ?? 'Workspace user'}</span><button title="Sign out" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" onClick={() => void signOut()}><LogOut size={16}/></button></div></div></header><div className="p-4 sm:p-8">{children}</div></main></div>
}
