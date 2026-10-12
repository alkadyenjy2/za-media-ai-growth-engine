import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolvePreviewBuildEnv } from './scripts/preview-build-env.mjs'
import type { PreviewDeploymentConfig } from './scripts/preview-build-env.mjs'

const deploymentConfigPath = fileURLToPath(new URL('./preview-deployment.json', import.meta.url))
const previewDeployment = JSON.parse(
  readFileSync(deploymentConfigPath, 'utf8'),
) as PreviewDeploymentConfig

export default defineConfig(({ mode }) => {
  const inheritedEnv = {
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  }
  const branch = process.env.CF_PAGES_BRANCH
  const buildEnv = resolvePreviewBuildEnv(inheritedEnv, previewDeployment, branch)
  const useDedicatedPreview =
    previewDeployment.enabled === true && branch === previewDeployment.branch

  return {
    plugins: [react()],
    define: useDedicatedPreview
      ? {
          'import.meta.env.VITE_CONVEX_URL': JSON.stringify(buildEnv.VITE_CONVEX_URL ?? ''),
          'import.meta.env.VITE_CONVEX_SITE_URL': JSON.stringify(buildEnv.VITE_CONVEX_SITE_URL ?? ''),
        }
      : {},
    server: { port: 5173, host: true },
  }
})
