import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { convex } from './lib/convex'
import { authClient } from './lib/auth-client'
import './index.css'
import App from './App'
createRoot(document.getElementById('root')!).render(<StrictMode><ConvexBetterAuthProvider client={convex} authClient={authClient}><App /></ConvexBetterAuthProvider></StrictMode>)



