import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { resolveConvexFrontendConfig } from './lib/preview-config.js'
import { PreviewFallback } from './PreviewFallback'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('ZA Media root element #root was not found')
}
const root = createRoot(rootElement)

const frontendConfig = resolveConvexFrontendConfig({
  VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
  VITE_CONVEX_SITE_URL: import.meta.env.VITE_CONVEX_SITE_URL,
})

if (frontendConfig.status === 'missing') {
  root.render(
    <StrictMode>
      <PreviewFallback reason="missing-config" />
    </StrictMode>,
  )
} else {
  void Promise.all([
    import('@convex-dev/better-auth/react'),
    import('./lib/convex'),
    import('./lib/auth-client'),
    import('./App'),
  ]).then(([providerModule, convexModule, authModule, appModule]) => {
    const ConvexBetterAuthProvider = providerModule.ConvexBetterAuthProvider
    root.render(
      <StrictMode>
        <ConvexBetterAuthProvider client={convexModule.convex} authClient={authModule.authClient}>
          <appModule.default />
        </ConvexBetterAuthProvider>
      </StrictMode>,
    )
  }).catch((error: unknown) => {
    console.error('ZA Media application bootstrap failed', error)
    root.render(
      <StrictMode>
        <PreviewFallback reason="bootstrap" />
      </StrictMode>,
    )
  })
}
