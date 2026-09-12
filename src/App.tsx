import { useState } from 'react'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import type { PageKey } from './components/Sidebar'
import { LandingPage } from './pages/LandingPage'
import { OverviewPage } from './pages/OverviewPage'
import { LeadsPage } from './pages/LeadsPage'
import { ConversationsPage } from './pages/ConversationsPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { CompaniesPage } from './pages/CompaniesPage'
import { IncomePage } from './pages/IncomePage'
import { AuditPage } from './pages/AuditPage'

export default function App() {
  const [view, setView] = useState<'website' | 'dashboard'>('website')
  const [page, setPage] = useState<PageKey>('overview')

  if (view === 'website') return <LandingPage onEnterDashboard={() => setView('dashboard')} />

  const content = page === 'overview' ? <OverviewPage /> : page === 'leads' ? <LeadsPage /> : page === 'conversations' ? <ConversationsPage /> : page === 'campaigns' ? <CampaignsPage /> : page === 'companies' ? <CompaniesPage /> : page === 'income' ? <IncomePage /> : <AuditPage />

  return <RequireAuth><Layout active={page} onNavigate={setPage}>{content}</Layout></RequireAuth>
}
