import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../public/_worker.js'

const upstreamOrigin = 'https://ideacollector-enjy2026.vercel.app'

async function withFetch(mock, run) {
  const original = globalThis.fetch
  globalThis.fetch = mock
  try {
    await run()
  } finally {
    globalThis.fetch = original
  }
}

test('mirror forwards the request to the fixed upstream without cookies or origin', async () => {
  await withFetch(async request => {
    assert.equal(request.url, upstreamOrigin + '/api/dashboard/overview?source=mirror')
    assert.equal(request.method, 'GET')
    assert.equal(request.headers.get('cookie'), null)
    assert.equal(request.headers.get('origin'), null)
    assert.equal(request.headers.get('x-private-internal'), null)
    return new Response('{"total_ideas":0}', {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
    })
  }, async () => {
    const request = new Request('https://cloudflare-ideacollector-mirror-preview.pages.dev/api/dashboard/overview?source=mirror', {
      headers: {
        accept: 'application/json',
        cookie: 'session=must-not-forward',
        origin: 'https://cloudflare-ideacollector-mirror-preview.pages.dev',
        'x-private-internal': 'must-not-forward',
      },
    })
    const response = await worker.fetch(request)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-ideacollector-mirror'), 'cloudflare-edge')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { total_ideas: 0 })
  })
})

test('mirror forwards JSON POST body and explicit bearer auth without forwarding browser cookies', async () => {
  const payload = { url: 'https://example.org/video' }
  await withFetch(async request => {
    assert.equal(request.url, upstreamOrigin + '/api/analyze-video')
    assert.equal(request.method, 'POST')
    assert.equal(request.headers.get('content-type'), 'application/json')
    assert.equal(request.headers.get('authorization'), 'Bearer test-api-token')
    assert.equal(request.headers.get('cookie'), null)
    assert.deepEqual(await request.json(), payload)
    return new Response('{"status":"ANALYSIS_UNAVAILABLE"}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }, async () => {
    const request = new Request('https://cloudflare-ideacollector-mirror-preview.pages.dev/api/analyze-video', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-api-token',
        cookie: 'session=must-not-forward',
      },
      body: JSON.stringify(payload),
    })
    const response = await worker.fetch(request)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ANALYSIS_UNAVAILABLE' })
  })
})

test('redirects to known Vercel aliases stay on the Cloudflare mirror', async () => {
  await withFetch(async () => new Response(null, {
    status: 302,
    headers: { location: 'https://ideacollector-iota.vercel.app/login?next=%2Fapp' },
  }), async () => {
    const request = new Request('https://cloudflare-ideacollector-mirror-preview.pages.dev/auth')
    const response = await worker.fetch(request)
    assert.equal(
      response.headers.get('location'),
      'https://cloudflare-ideacollector-mirror-preview.pages.dev/login?next=%2Fapp',
    )
  })
})

test('mirror rejects oversized request bodies before contacting upstream', async () => {
  let called = false
  await withFetch(async () => { called = true; return new Response('unexpected') }, async () => {
    const request = new Request('https://cloudflare-ideacollector-mirror-preview.pages.dev/api/analyze-video', {
      method: 'POST',
      body: JSON.stringify({ value: 'x'.repeat(2 * 1024 * 1024 + 1) }),
    })
    const response = await worker.fetch(request)
    assert.equal(response.status, 413)
    assert.equal(called, false)
  })
})
