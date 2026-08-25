import { authenticatedFetch } from './api';
/**
 * Webhook Proxy Security & Diagnostics Module
 * Enforces a strict whitelist for n8n Webhook destinations to prevent SSRF vulnerabilities
 * and provides diagnostic health check utilities.
 */

export const DEFAULT_PRODUCTION_WEBHOOK_URL = '';

// Destinations are configured per environment; no customer or private host is embedded in source.
export const HARDCODED_WEBHOOK_WHITELIST: readonly string[] = [];
export const ALLOWED_WEBHOOK_DOMAINS: readonly string[] = [];

/**
 * Validates a target webhook URL against SSRF rules and the whitelist of pre-approved destinations.
 */
export function isAllowedWebhookUrl(targetUrl: string): boolean {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(targetUrl.trim());

    // 1. Require HTTP/HTTPS scheme
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();

    // 2. Prevent SSRF against private networks / loopbacks / metadata services
    if (
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === 'localhost' ||
      host === '::1' ||
      host.startsWith('169.254.') ||
      host.startsWith('10.') ||
      host.startsWith('172.16.') ||
      host.startsWith('192.168.') ||
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      return false;
    }

    // 3. Check exact whitelist match
    const cleanTarget = parsed.origin + parsed.pathname;
    const isWhitelisted = HARDCODED_WEBHOOK_WHITELIST.some(
      (allowed) => allowed.toLowerCase() === cleanTarget.toLowerCase()
    );
    if (isWhitelisted) {
      return true;
    }

    // 4. Check domain match against allowed host list
    const allowedHosts = [...ALLOWED_WEBHOOK_DOMAINS];

    const envWebhook = process.env.VITE_N8N_WEBHOOK_URL;
    if (envWebhook) {
      try {
        const envParsed = new URL(envWebhook);
        allowedHosts.push(envParsed.hostname.toLowerCase());
      } catch {
        // ignore invalid env URL
      }
    }

    const customHosts = process.env.N8N_ALLOWED_HOSTS;
    if (customHosts) {
      const parsedCustom = customHosts.split(',').map((h) => h.trim().toLowerCase());
      allowedHosts.push(...parsedCustom);
    }

    const matchesDomain = allowedHosts.some(
      (domain) => host === domain || host.endsWith('.' + domain)
    );

    return matchesDomain;
  } catch {
    return false;
  }
}

/**
 * Resolves a safe, validated target webhook URL or falls back to the default production endpoint.
 */
export function resolveSafeWebhookUrl(requestedUrl?: string): string {
  if (requestedUrl && isAllowedWebhookUrl(requestedUrl)) {
    return requestedUrl.trim();
  }

  const envUrl = process.env.VITE_N8N_WEBHOOK_URL;
  if (envUrl && isAllowedWebhookUrl(envUrl)) {
    return envUrl.trim();
  }

  return '';
}

/**
 * Diagnostic health check to test if the configured n8n webhook URL is reachable.
 * Logs 'Connectivity Success' or 'Connectivity Error' to the console.
 */
export async function runN8nDiagnosticCheck(targetUrl?: string): Promise<{
  success: boolean;
  status?: number;
  message: string;
}> {
  const finalUrl = targetUrl || resolveSafeWebhookUrl();
  console.log(`[n8n Health Diagnostic] Testing reachability for: ${finalUrl}`);

  try {
    // Perform a lightweight POST ping to the proxy or destination
    const res = await authenticatedFetch('/api/n8n-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: finalUrl,
        payload: {
          event: 'health_check_ping',
          timestamp: new Date().toISOString(),
          source: 'n8n_diagnostic_checker'
        },
        sync: true
      })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success !== false) {
      if (data.workflowActive === false || data.status === 404) {
        const info = data.message || 'Workflow is awaiting activation in n8n UI.';
        console.log(`✅ [n8n Health Diagnostic] Connectivity Success: Host ${finalUrl} is connected! (${info})`);
        return {
          success: true,
          status: data.status || 404,
          message: `Connectivity Success: Server is reachable. ${info}`
        };
      }
      console.log(`✅ [n8n Health Diagnostic] Connectivity Success: Target ${finalUrl} returned HTTP ${res.status}`);
      return {
        success: true,
        status: res.status,
        message: `Connectivity Success: Target ${finalUrl} is active and reachable.`
      };
    } else if (res.status === 404 || data.status === 404) {
      const info = data.message || 'Workflow is currently inactive or awaiting activation in n8n UI.';
      console.log(`✅ [n8n Health Diagnostic] Connectivity Success: Host ${finalUrl} is reachable (${info})`);
      return {
        success: true,
        status: 404,
        message: `Connectivity Success: Server reachable (${info})`
      };
    } else {
      const errDetail = data.message || data.errorText || `HTTP ${res.status}`;
      console.warn(`⚠️ [n8n Health Diagnostic] Status notice: ${errDetail}`);
      return {
        success: false,
        status: res.status,
        message: `Status notice: ${errDetail}`
      };
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Network unreachable';
    console.error(`❌ [n8n Health Diagnostic] Connectivity Error: ${errorMsg}`);
    return {
      success: false,
      message: `Connectivity Error: ${errorMsg}`
    };
  }
}
