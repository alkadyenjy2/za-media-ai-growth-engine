import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConvexFrontendConfig } from '../src/lib/preview-config.js'

test('missing Convex URLs selects a safe static preview mode', () => {
  assert.deepEqual(resolveConvexFrontendConfig({}), {
    status: 'missing',
    convexUrl: '',
    siteUrl: '',
  })
})

test('whitespace-only Convex URLs are treated as missing', () => {
  assert.deepEqual(resolveConvexFrontendConfig({
    VITE_CONVEX_URL: '   ',
    VITE_CONVEX_SITE_URL: '\n',
  }), {
    status: 'missing',
    convexUrl: '',
    siteUrl: '',
  })
})

test('complete Convex URL configuration enables the full application', () => {
  assert.deepEqual(resolveConvexFrontendConfig({
    VITE_CONVEX_URL: ' https://example.eu-west-1.convex.cloud ',
    VITE_CONVEX_SITE_URL: ' https://example.eu-west-1.convex.site ',
  }), {
    status: 'ready',
    convexUrl: 'https://example.eu-west-1.convex.cloud',
    siteUrl: 'https://example.eu-west-1.convex.site',
  })
})
