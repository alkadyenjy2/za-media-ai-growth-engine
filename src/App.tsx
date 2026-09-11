import { useState } from 'react'
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
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'

function Dashboard() {
  const [page, setPage] = useState<PageKey>('overview')
  const content = page === 'overview' ? <OverviewPage /> : page === 'leads' ? <LeadsPage /> : page === 'conversations' ? <ConversationsPage /> : page === 'campaigns' ? <CampaignsPage /> : page === 'companies' ? <CompaniesPage /> : page === 'income' ? <IncomePage /> : <AuditPage />
  return <Layout active={page} onNavigate={setPage}>{content}</Layout>
}

export default function App() {
  const [view, setView] = useState<'website' | 'dashboard'>('website')
  return <AuthProvider>{view === 'website' ? <LandingPage onEnterDashboard={() => setView('dashboard')} /> : <RequireAuth><Dashboard /></RequireAuth>}</AuthProvider>
}
