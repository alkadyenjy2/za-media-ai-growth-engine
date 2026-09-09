import { useState } from 'react'
import { Layout } from './components/Layout'
import { LeadsPage } from './pages/LeadsPage'
import type { PageKey } from './components/Sidebar'

function Placeholder({ title }: { title: string }) { return <div className="card flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600"><span className="text-2xl font-display font-bold">ZE</span></div><h2 className="text-xl">{title}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">This workspace is connected to your live Supabase data. The next operational module will appear here.</p></div> }

export default function App() {
  const [page, setPage] = useState<PageKey>('leads')
  const content = page === 'leads' ? <LeadsPage /> : <Placeholder title={page === 'overview' ? 'Operations overview' : page === 'conversations' ? 'Conversations' : page === 'campaigns' ? 'Campaign manager' : page === 'companies' ? 'Companies & pages' : page === 'income' ? 'Income tracking' : 'Activity log'} />
  return <Layout active={page} onNavigate={setPage}>{content}</Layout>
}
