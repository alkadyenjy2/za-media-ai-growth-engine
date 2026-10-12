function normalizeHttpsOrigin(value) {
  if (typeof value !== 'string' || value.trim() === '') return null

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
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

export function resolvePreviewBuildEnv(currentEnv, deployment, branch) {
  const inheritedEnv = { ...currentEnv }
  if (deployment?.enabled !== true || branch !== deployment.branch) {
    return inheritedEnv
  }

  const convexUrl = normalizeHttpsOrigin(deployment.convexUrl)
  const convexSiteUrl = normalizeHttpsOrigin(deployment.convexSiteUrl)
  if (!convexUrl || !convexSiteUrl) {
    throw new Error('Enabled ZA Media preview requires valid HTTPS origin URLs for both Convex endpoints')
  }

  return {
    ...inheritedEnv,
    VITE_CONVEX_URL: convexUrl,
    VITE_CONVEX_SITE_URL: convexSiteUrl,
  }
}
