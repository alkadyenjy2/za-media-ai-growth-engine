import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from 'jsr:@b-fuze/deno-dom@0.1.50'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']
const MAX_HTML_BYTES = 1_500_000
const MAX_PAGES = 5

function responseJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders })
}

function normalizeUrl(raw: string) {
  const value = raw.trim()
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) websites are supported')
  if (url.username || url.password) throw new Error('Website URLs with embedded credentials are not allowed')
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname === '0.0.0.0') {
    throw new Error('Local/private hosts are not allowed')
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
    throw new Error('Private IP hosts are not allowed')
  }
  url.hash = ''
  return url
}

async function readLimited(response: Response) {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_HTML_BYTES) throw new Error(`Response exceeds ${MAX_HTML_BYTES} bytes`)
  const reader = response.body?.getReader()
  if (!reader) return await response.text()
  const decoder = new TextDecoder()
  let total = 0
  let output = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_HTML_BYTES) {
      await reader.cancel()
      throw new Error(`Response exceeds ${MAX_HTML_BYTES} bytes`)
    }
    output += decoder.decode(value, { stream: true })
  }
  output += decoder.decode()
  return output
}

async function fetchText(url: URL) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'ZA-Media-Growth-Intelligence/1.0' },
    })
    const text = await readLimited(response)
    return { response, text }
  } finally {
    clearTimeout(timeout)
  }
}

function parseRobots(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.split('#')[0].trim()).filter(Boolean)
  let applies = false
  const disallows: string[] = []
  const sitemaps: string[] = []
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':')
    const key = rawKey?.trim().toLowerCase()
    const value = rest.join(':').trim()
    if (key === 'user-agent') applies = value === '*' || value.toLowerCase().includes('za-media-growth-intelligence')
    if (applies && key === 'disallow' && value) disallows.push(value)
    if (key === 'sitemap' && value) sitemaps.push(value)
  }
  return { disallows, sitemaps }
}

function isPathDisallowed(pathname: string, disallows: string[]) {
  return disallows.some((rule) => rule && pathname.startsWith(rule.replace(/\*/g, '')))
}

function sha256(input: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)).then((buffer) =>
    Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join(''))
}

function cleanText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function parseHtml(html: string, pageUrl: URL) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!doc) throw new Error('Unable to parse HTML')
  const title = cleanText(doc.title)
  const description = cleanText(doc.querySelector('meta[name="description"]')?.getAttribute('content'))
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null
  const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null
  const h1 = Array.from(doc.querySelectorAll('h1')).map((node) => cleanText(node.textContent)).filter(Boolean).slice(0, 5)
  const h2 = Array.from(doc.querySelectorAll('h2')).map((node) => cleanText(node.textContent)).filter(Boolean).slice(0, 12)
  const links = Array.from(doc.querySelectorAll('a[href]')).map((node) => {
    try { return new URL(node.getAttribute('href')!, pageUrl.href).href } catch { return null }
  }).filter((url): url is string => Boolean(url))
  const internalLinks = [...new Set(links.filter((url) => {
    try { return new URL(url).origin === pageUrl.origin } catch { return false }
  }))].slice(0, 100)
  const socialLinks = [...new Set(links.filter((url) => /(?:facebook\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|x\.com|twitter\.com)/i.test(url)))]
  const og: Record<string, string> = {}
  for (const meta of doc.querySelectorAll('meta[property^="og:"]')) {
    const property = meta.getAttribute('property')?.slice(3)
    if (property) og[property] = cleanText(meta.getAttribute('content'))
  }
  const twitter: Record<string, string> = {}
  for (const meta of doc.querySelectorAll('meta[name^="twitter:"]')) {
    const name = meta.getAttribute('name')?.slice(8)
    if (name) twitter[name] = cleanText(meta.getAttribute('content'))
  }
  const jsonLd = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map((node) => cleanText(node.textContent)).slice(0, 10)
  const forms = doc.querySelectorAll('form').length
  const inputs = doc.querySelectorAll('input').length
  const buttons = Array.from(doc.querySelectorAll('button')).map((node) => cleanText(node.textContent)).filter(Boolean).slice(0, 20)
  const bodyText = cleanText(doc.body?.textContent).slice(0, 8_000)
  const scripts = Array.from(doc.querySelectorAll('script[src]')).map((node) => node.getAttribute('src') ?? '')
  const analytics = {
    googleAnalytics: scripts.some((src) => /googletagmanager|google-analytics/i.test(src)) || /gtag\(|google_tag_manager/i.test(html),
    metaPixel: /connect\.facebook\.net|fbq\(/i.test(html),
    hotjar: /hotjar/i.test(html),
  }
  return { title, description, canonical, robots, h1, h2, internalLinks, socialLinks, og, twitter, jsonLd, forms, inputs, buttons, bodyText, analytics }
}

function selectPages(home: URL, sitemapUrls: string[], internalLinks: string[]) {
  const candidates = [...sitemapUrls, ...internalLinks]
  const preferred = candidates.filter((url) => /\/(services?|solutions?|about|contact|pricing|products?|portfolio|case-stud)/i.test(url))
  const ordered = [...preferred, ...candidates]
  const seen = new Set<string>([home.href])
  const result: string[] = []
  for (const raw of ordered) {
    try {
      const url = new URL(raw)
      if (url.origin !== home.origin || seen.has(url.href)) continue
      if (!/^https?:$/.test(url.protocol)) continue
      seen.add(url.href)
      result.push(url.href)
      if (result.length >= MAX_PAGES - 1) break
    } catch { /* ignore invalid URLs */ }
  }
  return result
}

async function callGemini(key: string, prompt: string) {
  let lastError = 'Gemini request failed'
  for (const model of GEMINI_MODELS) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    })
    if (response.ok) {
      const payload = await response.json()
      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Gemini returned no candidate text')
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start < 0 || end < start) throw new Error('Gemini returned non-JSON output')
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    const body = await response.text()
    lastError = `Gemini ${model} failed (${response.status}): ${body.slice(0, 500)}`
    if (![400, 404].includes(response.status)) break
  }
  throw new Error(lastError)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return responseJson({ ok: false, error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')

    const input = await req.json()
    if (!input.prospect_id) throw new Error('prospect_id is required')

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: profile, error: profileError } = await supabase.from('prospect_profiles').select('*').eq('id', input.prospect_id).single()
    if (profileError) throw profileError
    if (!profile.website_url) throw new Error('Prospect has no website_url')

    const home = normalizeUrl(profile.website_url)
    const robotsUrl = new URL('/robots.txt', home)
    const robotsResult = await fetchText(robotsUrl).catch(() => null)
    const robots = robotsResult?.response.ok ? parseRobots(robotsResult.text) : { disallows: [], sitemaps: [] }
    if (isPathDisallowed(home.pathname || '/', robots.disallows)) {
      await supabase.from('prospect_evidence').insert({
        prospect_id: profile.id,
        evidence_type: 'website',
        source_type: 'public',
        source_name: 'robots.txt',
        source_url: robotsUrl.href,
        claim: 'Website crawling is disallowed for the requested path by robots.txt.',
        evidence_data: { blocked_path: home.pathname || '/', reason: 'robots.txt' },
        confidence: 1,
        evidence_key: 'website.crawl.blocked',
        evidence_status: 'invalid',
        extractor: 'website-intelligence/robots',
        severity: 'high',
        observed_at: new Date().toISOString(),
      })
      return responseJson({ ok: false, blocked: true, reason: 'robots.txt', prospect_id: profile.id }, 422)
    }

    const sitemapCandidates = robots.sitemaps.length ? robots.sitemaps : [new URL('/sitemap.xml', home).href]
    const sitemapUrls: string[] = []
    for (const raw of sitemapCandidates.slice(0, 3)) {
      try {
        const sitemapUrl = normalizeUrl(raw)
        if (sitemapUrl.origin !== home.origin) continue
        const result = await fetchText(sitemapUrl)
        if (!result.response.ok || !/xml/i.test(result.response.headers.get('content-type') ?? '')) continue
        const doc = new DOMParser().parseFromString(result.text, 'application/xml')
        for (const loc of doc?.querySelectorAll('loc') ?? []) {
          const href = cleanText(loc.textContent)
          if (href) sitemapUrls.push(href)
          if (sitemapUrls.length >= 20) break
        }
      } catch { /* sitemap is optional */ }
    }

    const pages: Array<Record<string, unknown>> = []
    let firstPageLinks: string[] = []
    for (const pageUrl of [home.href, ...selectPages(home, sitemapUrls, [])]) {
      try {
        const url = normalizeUrl(pageUrl)
        if (url.origin !== home.origin || isPathDisallowed(url.pathname || '/', robots.disallows)) continue
        const result = await fetchText(url)
        const contentType = result.response.headers.get('content-type') ?? ''
        if (!result.response.ok || !/text\/html|application\/xhtml\+xml/i.test(contentType)) continue
        const parsed = parseHtml(result.text, url)
        if (!firstPageLinks.length) firstPageLinks = parsed.internalLinks
        pages.push({ url: url.href, status: result.response.status, contentType, ...parsed, contentHash: await sha256(result.text) })
        if (pages.length >= MAX_PAGES) break
      } catch { /* continue with the remaining pages */ }
    }

    if (pages.length === 0) throw new Error('No crawlable HTML page was retrieved')
    if (pages.length === 1) {
      for (const pageUrl of selectPages(home, sitemapUrls, firstPageLinks)) {
        if (pages.length >= MAX_PAGES) break
        try {
          const url = normalizeUrl(pageUrl)
          if (url.origin !== home.origin || isPathDisallowed(url.pathname || '/', robots.disallows)) continue
          const result = await fetchText(url)
          const contentType = result.response.headers.get('content-type') ?? ''
          if (!result.response.ok || !/text\/html|application\/xhtml\+xml/i.test(contentType)) continue
          const parsed = parseHtml(result.text, url)
          pages.push({ url: url.href, status: result.response.status, contentType, ...parsed, contentHash: await sha256(result.text) })
        } catch { /* optional page */ }
      }
    }

    const homePage = pages[0] as any
    const evidenceRows: Record<string, unknown>[] = []
    const now = new Date().toISOString()
    const addEvidence = (row: Record<string, unknown>) => evidenceRows.push({ prospect_id: profile.id, observed_at: now, extractor: 'website-intelligence', evidence_status: 'active', ...row })

    addEvidence({ evidence_type: 'website', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.home.status', claim: `Homepage returned HTTP ${homePage.status}.`, evidence_data: { status: homePage.status, content_type: homePage.contentType }, http_status: homePage.status, mime_type: homePage.contentType, confidence: 1, severity: homePage.status >= 200 && homePage.status < 400 ? 'info' : 'high' })
    addEvidence({ evidence_type: 'website', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.meta.title', claim: homePage.title ? `Homepage title is "${homePage.title}".` : 'Homepage has no HTML title.', evidence_data: { title: homePage.title }, confidence: 1, severity: homePage.title ? 'info' : 'medium', impact: homePage.title ? null : 'Weak page identification for users and search systems.' })
    addEvidence({ evidence_type: 'seo', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.meta.description', claim: homePage.description ? 'Homepage has a meta description.' : 'Homepage has no meta description.', evidence_data: { description: homePage.description }, confidence: 1, severity: homePage.description ? 'info' : 'low', impact: homePage.description ? null : 'Reduced control over search snippets.' })
    addEvidence({ evidence_type: 'seo', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.canonical', claim: homePage.canonical ? 'Homepage declares a canonical URL.' : 'Homepage has no detected canonical URL.', evidence_data: { canonical: homePage.canonical }, confidence: 1, severity: homePage.canonical ? 'info' : 'low' })
    addEvidence({ evidence_type: 'geo', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.structured_data', claim: homePage.jsonLd?.length ? `Homepage exposes ${homePage.jsonLd.length} JSON-LD block(s).` : 'Homepage has no detected JSON-LD structured data.', evidence_data: { json_ld_blocks: homePage.jsonLd?.length ?? 0 }, confidence: 1, severity: homePage.jsonLd?.length ? 'info' : 'medium', impact: homePage.jsonLd?.length ? null : 'Weaker machine-readable entity/context signals.' })
    addEvidence({ evidence_type: 'website', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.headings', claim: homePage.h1?.length ? `Homepage has ${homePage.h1.length} H1 heading(s).` : 'Homepage has no detected H1 heading.', evidence_data: { h1: homePage.h1, h2: homePage.h2 }, confidence: 1, severity: homePage.h1?.length === 1 ? 'info' : 'medium' })
    addEvidence({ evidence_type: 'website', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.conversion.forms', claim: homePage.forms > 0 ? `Homepage contains ${homePage.forms} form(s).` : 'Homepage has no detected form.', evidence_data: { forms: homePage.forms, inputs: homePage.inputs, buttons: homePage.buttons }, confidence: 1, severity: homePage.forms > 0 ? 'info' : 'low', impact: homePage.forms > 0 ? null : 'No obvious form-based conversion path was detected on the homepage.' })
    addEvidence({ evidence_type: 'social', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.social.links', claim: homePage.socialLinks?.length ? `Homepage links to ${homePage.socialLinks.length} social profile(s).` : 'No supported social profile links were detected on the homepage.', evidence_data: { links: homePage.socialLinks }, confidence: 1, severity: homePage.socialLinks?.length ? 'info' : 'low' })
    addEvidence({ evidence_type: 'campaign', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.analytics.signals', claim: 'Detected analytics/marketing instrumentation signals from page source.', evidence_data: homePage.analytics, confidence: 0.95, severity: 'info' })
    addEvidence({ evidence_type: 'website', source_type: 'public', source_name: 'sitemap.xml', source_url: sitemapCandidates[0] ?? null, evidence_key: 'website.sitemap', claim: sitemapUrls.length ? `Discovered ${sitemapUrls.length} sitemap URL(s).` : 'No usable sitemap URLs were discovered.', evidence_data: { urls_discovered: sitemapUrls.length }, confidence: 1, severity: sitemapUrls.length ? 'info' : 'low' })

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    let aiAnalysis: Record<string, unknown> = {}
    if (geminiKey) {
      const compactPages = pages.map((page: any) => ({ url: page.url, title: page.title, description: page.description, canonical: page.canonical, h1: page.h1, h2: page.h2, socialLinks: page.socialLinks, og: page.og, twitter: page.twitter, jsonLd: page.jsonLd, forms: page.forms, buttons: page.buttons, analytics: page.analytics, bodyText: page.bodyText }))
      const evidenceCatalog = evidenceRows.map((row: any) => ({ evidence_key: row.evidence_key, claim: row.claim, evidence_data: row.evidence_data, severity: row.severity }))
      aiAnalysis = await callGemini(geminiKey, `You are the evidence-first website intelligence layer for a growth agency. Use ONLY the supplied crawl facts. Do not invent metrics or facts. Return JSON with: summary (string), findings (array of objects with evidence_key, claim, severity, confidence, impact, recommended_action), positioning_gaps (array of strings), conversion_gaps (array of strings), search_gaps (array of strings). Every finding must reference an existing evidence_key.\nEvidence catalog:\n${JSON.stringify(evidenceCatalog)}\nCrawl facts:\n${JSON.stringify(compactPages)}`)
    }

    const aiFindings = Array.isArray(aiAnalysis.findings) ? aiAnalysis.findings.slice(0, 12) : []
    for (const finding of aiFindings) {
      if (!finding?.evidence_key || !evidenceRows.some((row: any) => row.evidence_key === finding.evidence_key)) continue
      addEvidence({ evidence_type: 'derived', source_type: 'derived', source_name: 'Gemini website analysis', source_url: homePage.url, evidence_key: `ai.${finding.evidence_key}`, claim: String(finding.claim ?? ''), evidence_data: { based_on: finding.evidence_key, recommended_action: finding.recommended_action ?? null }, confidence: Math.max(0, Math.min(1, Number(finding.confidence ?? 0))), severity: ['info','low','medium','high','critical'].includes(finding.severity) ? finding.severity : 'medium', impact: finding.impact ?? null })
    }

    if (evidenceRows.length) {
      await supabase.from('prospect_evidence').insert(evidenceRows)
    }

    const websiteIntelligence = {
      crawled_at: now,
      pages_crawled: pages.length,
      sitemap_urls_discovered: sitemapUrls.length,
      social_links: homePage.socialLinks ?? [],
      home: { title: homePage.title, description: homePage.description, canonical: homePage.canonical, h1: homePage.h1, forms: homePage.forms, json_ld_blocks: homePage.jsonLd?.length ?? 0 },
      ai: aiAnalysis,
    }
    const nextProfileData = { ...(profile.profile_data ?? {}), website_intelligence: websiteIntelligence }
    await supabase.from('prospect_profiles').update({ profile_data: nextProfileData, last_observed_at: now, lifecycle_status: profile.lifecycle_status === 'discovered' ? 'researching' : profile.lifecycle_status, updated_at: now }).eq('id', profile.id)
    await supabase.from('audit_logs').insert({ action: 'website_intelligence', entity_type: 'prospect_profile', entity_id: profile.id, actor: 'AI Core', details: { pages_crawled: pages.length, evidence_count: evidenceRows.length } })

    return responseJson({ ok: true, prospect_id: profile.id, pages_crawled: pages.length, evidence_count: evidenceRows.length, social_links: homePage.socialLinks ?? [], analysis: aiAnalysis })
  } catch (error) {
    return responseJson({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
