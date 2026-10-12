const UPSTREAM_ORIGIN = 'https://ideacollector-enjy2026.vercel.app'
const ALLOWED_REDIRECT_HOSTS = new Set([
  'ideacollector-enjy2026.vercel.app',
  'ideacollector-iota.vercel.app',
  'ideacollector-git-main-enjy2026.vercel.app',
])
const MAX_API_BODY_BYTES = 2 * 1024 * 1024

function makeJson(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function rewriteRedirect(location, requestOrigin) {
  if (!location) return location
  try {
    const upstream = new URL(location, UPSTREAM_ORIGIN)
    if (!ALLOWED_REDIRECT_HOSTS.has(upstream.hostname)) return location
    return new URL(upstream.pathname + upstream.search + upstream.hash, requestOrigin).toString()
  } catch {
    return location
  }
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url)
    const upstream = new URL(incoming.pathname + incoming.search, UPSTREAM_ORIGIN)
    const method = request.method.toUpperCase()

    // This is a fixed-origin mirror, not an open proxy. The caller controls
    // only the path and query; upstream origin is never derived from input.
    const headers = new Headers()
    for (const name of ['accept', 'content-type', 'authorization']) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }

    const init = { method, headers, redirect: 'manual' }
    if (method !== 'GET' && method !== 'HEAD') {
      const body = await request.arrayBuffer()
      if (body.byteLength > MAX_API_BODY_BYTES) {
        return makeJson({ error: 'Request body exceeds mirror limit' }, 413)
      }
      init.body = body
    }

    let upstreamResponse
    try {
      upstreamResponse = await fetch(new Request(upstream.toString(), init))
    } catch {
      return makeJson({ error: 'IdeaCollector upstream is unavailable' }, 502)
    }

    const responseHeaders = new Headers(upstreamResponse.headers)
    responseHeaders.set('x-ideacollector-mirror', 'cloudflare-edge')
    if (upstream.pathname === '/api' || upstream.pathname.startsWith('/api/')) {
      responseHeaders.set('cache-control', 'no-store')
    }
    const location = responseHeaders.get('location')
    if (location) responseHeaders.set('location', rewriteRedirect(location, incoming.origin))

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    })
  },
}
