import { useEffect, useState } from 'react'
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

function Dashboard({ initialPage = 'overview', onNavigate }: { initialPage?: PageKey; onNavigate: (page: PageKey) => void }) {
  const [page, setPage] = useState<PageKey>(initialPage)
  const navigate = (next: PageKey) => { setPage(next); onNavigate(next) }
  const content = page === 'overview' ? <OverviewPage /> : page === 'leads' ? <LeadsPage /> : page === 'conversations' ? <ConversationsPage /> : page === 'campaigns' ? <CampaignsPage /> : page === 'companies' ? <CompaniesPage /> : page === 'income' ? <IncomePage /> : <AuditPage />
  return <Layout active={page} onNavigate={navigate}>{content}</Layout>
}

const dashboardPages: Record<string, PageKey> = {
  '/app': 'overview', '/app/': 'overview', '/app/leads': 'leads', '/app/conversations': 'conversations',
  '/app/campaigns': 'campaigns', '/app/companies': 'companies', '/app/income': 'income', '/app/activity': 'audit',
}

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname)
  const go = (next: string) => { if (next !== window.location.pathname) window.history.pushState({}, '', next); setPath(next) }
  useEffect(() => { const onPopState = () => setPath(window.location.pathname); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState) }, [])
  const dashboardPage = dashboardPages[path]
  const isPublicLanding = path === '/' || path === '/services' || path.startsWith('/services/') || path === '/audit' || path === '/book-a-strategy-call'
  return <AuthProvider>{isPublicLanding ? <LandingPage initialOpen={path === '/audit' || path === '/book-a-strategy-call'} onEnterDashboard={() => go('/app')} /> : dashboardPage ? <RequireAuth><Dashboard initialPage={dashboardPage} onNavigate={(page) => go(`/app/${page === 'overview' ? '' : page === 'audit' ? 'activity' : page}`)} /></RequireAuth> : <LandingPage onEnterDashboard={() => go('/app')} />}</AuthProvider>
}
