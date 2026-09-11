import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from 'jsr:@b-fuze/deno-dom@0.1.50'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']
const MAX_BYTES = 1_500_000
const MAX_PAGES = 5

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders })
const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()

function normalizeUrl(raw: string) {
  const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public HTTP(S) website URLs are supported')
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) throw new Error('Private/local hosts are not allowed')
  url.hash = ''
  return url
}

async function readLimited(response: Response) {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) throw new Error('Website response is too large')
  const reader = response.body?.getReader()
  if (!reader) return response.text()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) { await reader.cancel(); throw new Error('Website response is too large') }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

async function fetchText(url: URL) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'ZA-Media-Growth-Intelligence/1.0' } })
    return { response, text: await readLimited(response) }
  } finally { clearTimeout(timeout) }
}

function robotsInfo(text: string) {
  const lines = text.split(/\r?\n/).map((x) => x.split('#')[0].trim()).filter(Boolean)
  let applies = false
  const disallows: string[] = []
  const sitemaps: string[] = []
  for (const line of lines) {
    const [keyRaw, ...rest] = line.split(':')
    const key = keyRaw.toLowerCase().trim(); const value = rest.join(':').trim()
    if (key === 'user-agent') applies = value === '*' || value.toLowerCase().includes('za-media-growth-intelligence')
    if (applies && key === 'disallow' && value) disallows.push(value)
    if (key === 'sitemap' && value) sitemaps.push(value)
  }
  return { disallows, sitemaps }
}

const disallowed = (path: string, rules: string[]) => rules.some((rule) => rule && path.startsWith(rule.replace(/\*/g, '')))
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map((b) => b.toString(16).padStart(2, '0')).join('')

function parseHtml(html: string, pageUrl: URL) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!doc) throw new Error('Unable to parse HTML')
  const links = Array.from(doc.querySelectorAll('a[href]')).map((node) => { try { return new URL(node.getAttribute('href')!, pageUrl.href).href } catch { return null } }).filter((x): x is string => Boolean(x))
  const internalLinks = [...new Set(links.filter((x) => { try { return new URL(x).origin === pageUrl.origin } catch { return false } }))].slice(0, 100)
  const socialLinks = [...new Set(links.filter((x) => /(?:facebook\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|x\.com|twitter\.com)/i.test(x)))]
  const meta = (selector: string) => clean(doc.querySelector(selector)?.getAttribute('content'))
  const jsonLd = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map((n) => clean(n.textContent)).slice(0, 10)
  const scripts = Array.from(doc.querySelectorAll('script[src]')).map((n) => n.getAttribute('src') ?? '')
  return {
    title: clean(doc.title), description: meta('meta[name="description"]'), canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    robots: meta('meta[name="robots"]'), h1: Array.from(doc.querySelectorAll('h1')).map((n) => clean(n.textContent)).filter(Boolean).slice(0, 5),
    h2: Array.from(doc.querySelectorAll('h2')).map((n) => clean(n.textContent)).filter(Boolean).slice(0, 12), socialLinks, internalLinks,
    og: Object.fromEntries(Array.from(doc.querySelectorAll('meta[property^="og:"]')).map((n) => [n.getAttribute('property')?.slice(3), clean(n.getAttribute('content'))]).filter(([k]) => Boolean(k))),
    twitter: Object.fromEntries(Array.from(doc.querySelectorAll('meta[name^="twitter:"]')).map((n) => [n.getAttribute('name')?.slice(8), clean(n.getAttribute('content'))]).filter(([k]) => Boolean(k))),
    jsonLd, forms: doc.querySelectorAll('form').length, inputs: doc.querySelectorAll('input').length,
    buttons: Array.from(doc.querySelectorAll('button')).map((n) => clean(n.textContent)).filter(Boolean).slice(0, 20),
    bodyText: clean(doc.body?.textContent).slice(0, 8_000),
    analytics: { googleAnalytics: scripts.some((x) => /googletagmanager|google-analytics/i.test(x)) || /gtag\(|google_tag_manager/i.test(html), metaPixel: /connect\.facebook\.net|fbq\(/i.test(html), hotjar: /hotjar/i.test(html) },
  }
}

function pickPages(home: URL, sitemapUrls: string[], internalLinks: string[]) {
  const candidates = [...sitemapUrls, ...internalLinks]
  const preferred = candidates.filter((x) => /\/(services?|solutions?|about|contact|pricing|products?|portfolio|case-stud)/i.test(x))
  const seen = new Set([home.href]); const result: string[] = []
  for (const raw of [...preferred, ...candidates]) {
    try { const url = new URL(raw); if (url.origin !== home.origin || seen.has(url.href)) continue; seen.add(url.href); result.push(url.href); if (result.length >= MAX_PAGES - 1) break } catch { /* ignore */ }
  }
  return result
}

async function gemini(key: string, prompt: string) {
  let last = 'Gemini request failed'
  for (const model of GEMINI_MODELS) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }) })
    if (response.ok) {
      const payload = await response.json(); const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Gemini returned no candidate text')
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim(); const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}')
      if (start < 0 || end < start) throw new Error('Gemini returned non-JSON output')
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    const body = await response.text(); last = `Gemini ${model} failed (${response.status}): ${body.slice(0, 500)}`
    if (![400, 404].includes(response.status)) break
  }
  throw new Error(last)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL'); const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')
    const input = await req.json(); if (!input.prospect_id) throw new Error('prospect_id is required')
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: profile, error: profileError } = await supabase.from('prospect_profiles').select('*').eq('id', input.prospect_id).single()
    if (profileError) throw profileError
    if (!profile.website_url) throw new Error('Prospect has no website_url')

    const home = normalizeUrl(profile.website_url); const robotsUrl = new URL('/robots.txt', home); const robotsResult = await fetchText(robotsUrl).catch(() => null)
    const robots = robotsResult?.response.ok ? robotsInfo(robotsResult.text) : { disallows: [], sitemaps: [] }
    if (disallowed(home.pathname || '/', robots.disallows)) {
      await supabase.from('prospect_evidence').insert({ prospect_id: profile.id, evidence_type: 'website', source_type: 'public', source_name: 'robots.txt', source_url: robotsUrl.href, claim: 'Website crawling is disallowed for the requested path by robots.txt.', evidence_data: { blocked_path: home.pathname || '/' }, confidence: 1, evidence_key: 'website.crawl.blocked', evidence_status: 'invalid', extractor: 'website-intelligence/robots', severity: 'high', observed_at: new Date().toISOString() })
      return json({ ok: false, blocked: true, reason: 'robots.txt', prospect_id: profile.id }, 422)
    }

    const sitemapCandidates = robots.sitemaps.length ? robots.sitemaps : [new URL('/sitemap.xml', home).href]; const sitemapUrls: string[] = []
    for (const raw of sitemapCandidates.slice(0, 3)) {
      try { const url = normalizeUrl(raw); if (url.origin !== home.origin) continue; const result = await fetchText(url); if (!result.response.ok) continue; const doc = new DOMParser().parseFromString(result.text, 'application/xml'); for (const loc of doc?.querySelectorAll('loc') ?? []) { const href = clean(loc.textContent); if (href) sitemapUrls.push(href); if (sitemapUrls.length >= 20) break } } catch { /* optional */ }
    }

    const pages: any[] = []; let firstLinks: string[] = []
    for (const raw of [home.href, ...pickPages(home, sitemapUrls, [])]) {
      try { const url = normalizeUrl(raw); if (url.origin !== home.origin || disallowed(url.pathname || '/', robots.disallows)) continue; const result = await fetchText(url); const type = result.response.headers.get('content-type') ?? ''; if (!result.response.ok || !/text\/html|application\/xhtml\+xml/i.test(type)) continue; const parsed = parseHtml(result.text, url); if (!firstLinks.length) firstLinks = parsed.internalLinks; pages.push({ url: url.href, status: result.response.status, contentType: type, ...parsed, contentHash: await hash(result.text) }); if (pages.length >= MAX_PAGES) break } catch { /* optional */ }
    }
    if (pages.length === 1) for (const raw of pickPages(home, sitemapUrls, firstLinks)) {
      if (pages.length >= MAX_PAGES) break
      try { const url = normalizeUrl(raw); if (url.origin !== home.origin || disallowed(url.pathname || '/', robots.disallows)) continue; const result = await fetchText(url); const type = result.response.headers.get('content-type') ?? ''; if (!result.response.ok || !/text\/html|application\/xhtml\+xml/i.test(type)) continue; pages.push({ url: url.href, status: result.response.status, contentType: type, ...parseHtml(result.text, url), contentHash: await hash(result.text) }) } catch { /* optional */ }
    }
    if (!pages.length) throw new Error('No crawlable HTML page was retrieved')

    const homePage = pages[0]; const observed = new Date().toISOString(); const evidence: any[] = []
    const add = (row: any) => evidence.push({ prospect_id: profile.id, observed_at: observed, extractor: 'website-intelligence', evidence_status: 'active', ...row })
    add({ evidence_type: 'website', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.home.status', claim: `Homepage returned HTTP ${homePage.status}.`, evidence_data: { status: homePage.status, content_type: homePage.contentType }, confidence: 1, severity: 'info', http_status: homePage.status, mime_type: homePage.contentType, content_hash: homePage.contentHash })
    add({ evidence_type: 'website', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.meta.title', claim: homePage.title ? `Homepage title is "${homePage.title}".` : 'Homepage has no HTML title.', evidence_data: { title: homePage.title }, confidence: 1, severity: homePage.title ? 'info' : 'medium', impact: homePage.title ? null : 'Weak page identification for users and search systems.' })
    add({ evidence_type: 'seo', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.meta.description', claim: homePage.description ? 'Homepage has a meta description.' : 'Homepage has no meta description.', evidence_data: { description: homePage.description }, confidence: 1, severity: homePage.description ? 'info' : 'low', impact: homePage.description ? null : 'Reduced control over search snippets.' })
    add({ evidence_type: 'seo', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.canonical', claim: homePage.canonical ? 'Homepage declares a canonical URL.' : 'Homepage has no detected canonical URL.', evidence_data: { canonical: homePage.canonical }, confidence: 1, severity: homePage.canonical ? 'info' : 'low' })
    add({ evidence_type: 'geo', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.structured_data', claim: homePage.jsonLd?.length ? `Homepage exposes ${homePage.jsonLd.length} JSON-LD block(s).` : 'Homepage has no detected JSON-LD structured data.', evidence_data: { json_ld_blocks: homePage.jsonLd?.length ?? 0 }, confidence: 1, severity: homePage.jsonLd?.length ? 'info' : 'medium', impact: homePage.jsonLd?.length ? null : 'Weaker machine-readable entity/context signals.' })
    add({ evidence_type: 'website', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.headings', claim: homePage.h1?.length ? `Homepage has ${homePage.h1.length} H1 heading(s).` : 'Homepage has no detected H1 heading.', evidence_data: { h1: homePage.h1, h2: homePage.h2 }, confidence: 1, severity: homePage.h1?.length === 1 ? 'info' : 'medium' })
    add({ evidence_type: 'website', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.conversion.forms', claim: homePage.forms > 0 ? `Homepage contains ${homePage.forms} form(s).` : 'Homepage has no detected form.', evidence_data: { forms: homePage.forms, inputs: homePage.inputs, buttons: homePage.buttons }, confidence: 1, severity: homePage.forms > 0 ? 'info' : 'low', impact: homePage.forms > 0 ? null : 'No obvious form-based conversion path was detected on the homepage.' })
    add({ evidence_type: 'social', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.social.links', claim: homePage.socialLinks?.length ? `Homepage links to ${homePage.socialLinks.length} social profile(s).` : 'No supported social profile links were detected on the homepage.', evidence_data: { links: homePage.socialLinks }, confidence: 1, severity: homePage.socialLinks?.length ? 'info' : 'low' })
    add({ evidence_type: 'campaign', source_type: 'public', source_name: 'website.html', source_url: homePage.url, evidence_key: 'website.analytics.signals', claim: 'Detected analytics/marketing instrumentation signals from page source.', evidence_data: homePage.analytics, confidence: 0.95, severity: 'info' })
    add({ evidence_type: 'seo', source_type: 'public', source_name: 'sitemap.xml', source_url: sitemapCandidates[0] ?? null, evidence_key: 'website.sitemap', claim: sitemapUrls.length ? `Discovered ${sitemapUrls.length} sitemap URL(s).` : 'No usable sitemap URLs were discovered.', evidence_data: { urls_discovered: sitemapUrls.length }, confidence: 1, severity: sitemapUrls.length ? 'info' : 'low' })

    let analysis: any = {}
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (geminiKey) {
      const facts = pages.map((p) => ({ url: p.url, title: p.title, description: p.description, canonical: p.canonical, h1: p.h1, h2: p.h2, socialLinks: p.socialLinks, og: p.og, twitter: p.twitter, jsonLd: p.jsonLd, forms: p.forms, buttons: p.buttons, analytics: p.analytics, bodyText: p.bodyText }))
      const catalog = evidence.map((e) => ({ evidence_key: e.evidence_key, claim: e.claim, evidence_data: e.evidence_data, severity: e.severity }))
      analysis = await gemini(geminiKey, `You are an evidence-first website intelligence layer. Use ONLY supplied facts. Return JSON: summary, findings[], positioning_gaps[], conversion_gaps[], search_gaps[]. Each finding must contain evidence_key, claim, severity, confidence, impact, recommended_action and must reference an existing evidence_key. Do not invent metrics.\nEvidence:\n${JSON.stringify(catalog)}\nPages:\n${JSON.stringify(facts)}`)
    }
    for (const finding of Array.isArray(analysis.findings) ? analysis.findings.slice(0, 12) : []) {
      if (!finding?.evidence_key || !evidence.some((e) => e.evidence_key === finding.evidence_key)) continue
      add({ evidence_type: 'website', source_type: 'derived', source_name: 'Gemini website analysis', source_url: homePage.url, evidence_key: `ai.${finding.evidence_key}`, claim: String(finding.claim ?? ''), evidence_data: { based_on: finding.evidence_key, recommended_action: finding.recommended_action ?? null }, confidence: Math.max(0, Math.min(1, Number(finding.confidence ?? 0))), severity: ['info','low','medium','high','critical'].includes(finding.severity) ? finding.severity : 'medium', impact: finding.impact ?? null })
    }

    const { error: evidenceError } = await supabase.from('prospect_evidence').insert(evidence)
    if (evidenceError) throw evidenceError
    const profileData = { ...(profile.profile_data ?? {}), website_intelligence: { observed_at: observed, pages_crawled: pages.length, sitemap_urls_discovered: sitemapUrls.length, social_links: homePage.socialLinks ?? [], home: { title: homePage.title, description: homePage.description, canonical: homePage.canonical, h1: homePage.h1, forms: homePage.forms, json_ld_blocks: homePage.jsonLd?.length ?? 0 }, ai: analysis } }
    await supabase.from('prospect_profiles').update({ profile_data: profileData, last_observed_at: observed, lifecycle_status: profile.lifecycle_status === 'discovered' ? 'researching' : profile.lifecycle_status, updated_at: observed }).eq('id', profile.id)
    await supabase.from('audit_logs').insert({ action: 'website_intelligence', entity_type: 'prospect_profile', entity_id: profile.id, actor: 'AI Core', details: { pages_crawled: pages.length, evidence_count: evidence.length } })
    return json({ ok: true, prospect_id: profile.id, pages_crawled: pages.length, evidence_count: evidence.length, social_links: homePage.socialLinks ?? [], analysis })
  } catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500) }
})
