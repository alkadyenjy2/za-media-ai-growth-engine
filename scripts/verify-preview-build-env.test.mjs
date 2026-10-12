import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePreviewBuildEnv } from './preview-build-env.mjs'

const branch = 'chore/za-static-host-fallback-20261012'
const deployment = {
  enabled: false,
  branch,
  convexUrl: 'https://rosy-hare-228.eu-west-1.convex.cloud',
  convexSiteUrl: 'https://rosy-hare-228.eu-west-1.convex.site',
}
const currentEnv = {
  VITE_CONVEX_URL: '',
  VITE_CONVEX_SITE_URL: '',
  OTHER_BUILD_FLAG: 'keep-me',
}

test('preview endpoint injection remains disabled by default', () => {
  assert.deepEqual(resolvePreviewBuildEnv(currentEnv, deployment, branch), currentEnv)
})

test('enabled preview config injects only the matching branch endpoints', () => {
  const result = resolvePreviewBuildEnv(
    currentEnv,
    { ...deployment, enabled: true },
    branch,
  )
  assert.equal(result.VITE_CONVEX_URL, deployment.convexUrl)
  assert.equal(result.VITE_CONVEX_SITE_URL, deployment.convexSiteUrl)
  assert.equal(result.OTHER_BUILD_FLAG, 'keep-me')
})

test('enabled preview config never overrides main or another branch', () => {
  const enabled = { ...deployment, enabled: true }
  assert.deepEqual(resolvePreviewBuildEnv(currentEnv, enabled, 'main'), currentEnv)
  assert.deepEqual(resolvePreviewBuildEnv(currentEnv, enabled, 'feature/other'), currentEnv)
})

test('invalid or non-HTTPS Convex endpoints are rejected before build-time injection', () => {
  assert.throws(
    () => resolvePreviewBuildEnv(
      currentEnv,
      { ...deployment, enabled: true, convexUrl: 'http://localhost:3000' },
      branch,
    ),
    /valid HTTPS origin/,
  )
  assert.throws(
    () => resolvePreviewBuildEnv(
      currentEnv,
      { ...deployment, enabled: true, convexSiteUrl: 'https://example.com/path' },
      branch,
    ),
    /valid HTTPS origin/,
  )
})
