function normalizeHttpsOrigin(value) {
  if (typeof value !== 'string' || value.trim() === '') return ''

  try {
    const url = new URL(value.trim())
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      url.username !== '' ||
      url.password !== ''
    ) {
      return ''
    }
    return url.origin
  } catch {
    return ''
  }
}

export function resolveConvexFrontendConfig(env) {
  const convexUrl = normalizeHttpsOrigin(env?.VITE_CONVEX_URL)
  const siteUrl = normalizeHttpsOrigin(env?.VITE_CONVEX_SITE_URL)

  if (!convexUrl || !siteUrl) {
    return { status: 'missing', convexUrl: '', siteUrl: '' }
  }

  return { status: 'ready', convexUrl, siteUrl }
}
