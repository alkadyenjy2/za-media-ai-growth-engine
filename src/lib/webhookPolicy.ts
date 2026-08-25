/**
 * Server-safe n8n destination policy. This module must not import browser or Supabase client code.
 */
export const DEFAULT_PRODUCTION_WEBHOOK_URL = '';

function configuredHosts(configuredUrl?: string): string[] {
  const hosts: string[] = [];
  if (configuredUrl) {
    try { hosts.push(new URL(configuredUrl).hostname.toLowerCase()); } catch { /* invalid config is rejected */ }
  }
  if (typeof process !== 'undefined' && process.env?.N8N_ALLOWED_HOSTS) {
    hosts.push(...process.env.N8N_ALLOWED_HOSTS.split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
  }
  return hosts;
}

export function isAllowedWebhookUrl(targetUrl: string, configuredUrl = typeof process !== 'undefined' ? process.env?.N8N_WEBHOOK_URL || process.env?.VITE_N8N_WEBHOOK_URL : undefined): boolean {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  try {
    const parsed = new URL(targetUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    const privateHost = host === '127.0.0.1' || host === '0.0.0.0' || host === 'localhost' || host === '::1' ||
      host.startsWith('169.254.') || host.startsWith('10.') || host.startsWith('172.16.') ||
      host.startsWith('192.168.') || host.endsWith('.internal') || host.endsWith('.local');
    if (privateHost) return false;
    const hosts = configuredHosts(configuredUrl);
    return hosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
  } catch {
    return false;
  }
}

export function resolveSafeWebhookUrl(requestedUrl?: string, configuredUrl = typeof process !== 'undefined' ? process.env?.N8N_WEBHOOK_URL || process.env?.VITE_N8N_WEBHOOK_URL : undefined): string {
  if (requestedUrl && isAllowedWebhookUrl(requestedUrl, configuredUrl)) return requestedUrl.trim();
  if (configuredUrl && isAllowedWebhookUrl(configuredUrl, configuredUrl)) return configuredUrl.trim();
  return DEFAULT_PRODUCTION_WEBHOOK_URL;
}
