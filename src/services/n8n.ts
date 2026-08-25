import { Lead } from '../types';
import { logAiActionToSupabase } from '../lib/supabase';

import { authenticatedFetch } from '../lib/api';
export interface N8NExecutionResponse {
  success: boolean;
  httpStatus: number;
  isLive: boolean;
  messageId?: string;
  wamid?: string;
  eventId?: string;
  deliveryStatus: string;
  details: string;
  rawResponse?: any;
  error?: string;
}

export class N8NIntegrationService {
  private defaultWebhookUrl: string;

  constructor(defaultWebhookUrl?: string) {
    this.defaultWebhookUrl = defaultWebhookUrl || this.getStoredWebhookUrl();
  }

  private getStoredWebhookUrl(): string {
    const envUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_N8N_WEBHOOK_URL : undefined;
    if (envUrl && envUrl.trim().length > 0) {
      return envUrl.trim();
    }
    return '';
  }

  /**
   * Internal helper to execute HTTP POST requests to n8n webhook via API proxy
   */
  private async postToN8nProxy(webhookUrl: string, payload: Record<string, any>): Promise<{
    ok: boolean;
    status: number;
    data: any;
    simulated: boolean;
    errorText?: string;
  }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const endpoint = typeof window !== 'undefined'
        ? '/api/n8n-webhook'
        : (process.env.API_BASE_URL || 'http://localhost:3000/api/n8n-webhook');

      const res = await authenticatedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          webhookUrl,
          payload
        })
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown network error');
        return {
          ok: false,
          status: res.status,
          data: null,
          simulated: false,
          errorText: `HTTP ${res.status}: ${errorText}`
        };
      }

      const body = await res.json();
      return {
        ok: body.success === true,
        status: body.status || res.status,
        data: body.data || body,
        simulated: Boolean(body.simulated),
        errorText: body.message
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      return {
        ok: false,
        status: isTimeout ? 504 : 500,
        data: null,
        simulated: false,
        errorText: isTimeout ? 'Webhook connection timeout (12s limit)' : (err?.message || 'Network request failed')
      };
    }
  }

  /**
   * Dispatch WhatsApp Message via n8n Meta WhatsApp Cloud API Integration
   */
  async dispatchWhatsApp(
    lead: Lead,
    customMessage?: string,
    webhookUrl?: string
  ): Promise<N8NExecutionResponse> {
    const targetUrl = webhookUrl || this.defaultWebhookUrl;
    const message = customMessage || lead.salesAutomation?.socialDmText || `Hello ${lead.contactName}, following up on your inquiry with ${lead.companyName}.`;

    const payload = {
      event: 'whatsapp.dispatch',
      timestamp: new Date().toISOString(),
      lead_id: lead.id,
      companyName: lead.companyName,
      contactName: lead.contactName,
      phone: lead.phone,
      message
    };

    const result = await this.postToN8nProxy(targetUrl, payload);

    // Extract verified wamid/messageId ONLY if actually returned by provider
    const data = result.data || {};
    const wamid = data.wamid || data.wa_message_id || data.messageId;
    const isLive = result.ok && !result.simulated && Boolean(wamid);

    const verifiedRefId = wamid || 'UNVERIFIED_NO_PROVIDER_ID';
    const deliveryStatus = isLive 
      ? (data.deliveryStatus || `Sent via Meta WhatsApp API (wamid: ${wamid})`)
      : (result.ok ? 'Dispatched - Awaiting Provider Confirmation' : `WhatsApp Dispatch Failed: ${result.errorText || 'Unknown Error'}`);

    const details = isLive
      ? `Live Meta WhatsApp API dispatch confirmed. Verified wamid: ${verifiedRefId}`
      : `Event dispatched for ${lead.phone || 'Prospect'}: ${result.errorText || 'Awaiting provider receipt'}`;

    const providerReceipt = {
      provider: 'Meta WhatsApp Business Cloud API',
      http_status: result.status,
      external_ref_id: verifiedRefId,
      details,
      wamid: wamid || null
    };

    // Log action to Supabase ai_actions table
    await logAiActionToSupabase({
      agent_name: 'WhatsApp Business API',
      action_type: 'whatsapp_dispatched',
      target_lead_id: lead.id,
      payload: {
        step: '2. WhatsApp Dispatch',
        phone: lead.phone,
        contactName: lead.contactName,
        companyName: lead.companyName,
        message,
        delivery_id: verifiedRefId,
        wamid: wamid || null,
        delivery_status: deliveryStatus,
        provider_receipt: providerReceipt,
        is_live_external: isLive
      },
      status: isLive ? 'success' : (result.ok ? 'pending' : 'failed')
    });

    return {
      success: isLive || result.ok,
      httpStatus: result.status,
      isLive,
      wamid: wamid || undefined,
      messageId: wamid || undefined,
      deliveryStatus,
      details,
      rawResponse: result.data,
      error: result.ok ? undefined : result.errorText
    };
  }

  /**
   * Dispatch Proposal Email via n8n Gmail OAuth2 Integration
   */
  async dispatchGmail(
    lead: Lead,
    customSubject?: string,
    customBody?: string,
    webhookUrl?: string
  ): Promise<N8NExecutionResponse> {
    const targetUrl = webhookUrl || this.defaultWebhookUrl;
    const subject = customSubject || lead.salesAutomation?.emailSubject || `Growth Automation Proposal for ${lead.companyName}`;
    const bodyText = customBody || lead.salesAutomation?.emailBody || `Hi ${lead.contactName}, here is your tailored automation strategy for ${lead.companyName}.`;

    const payload = {
      event: 'gmail.proposal_dispatch',
      timestamp: new Date().toISOString(),
      lead_id: lead.id,
      companyName: lead.companyName,
      contactName: lead.contactName,
      email: lead.email,
      subject,
      body: bodyText
    };

    const result = await this.postToN8nProxy(targetUrl, payload);

    // Extract verified messageId ONLY if actually returned by provider
    const data = result.data || {};
    const messageId = data.messageId || data.gmail_id;
    const isLive = result.ok && !result.simulated && Boolean(messageId);

    const verifiedRefId = messageId || 'UNVERIFIED_NO_PROVIDER_ID';
    const deliveryStatus = isLive
      ? (data.deliveryStatus || `Sent via Gmail API (messageId: ${messageId})`)
      : (result.ok ? 'Dispatched - Awaiting Provider Confirmation' : `Gmail Dispatch Failed: ${result.errorText || 'Unknown Error'}`);

    const details = isLive
      ? `Live Gmail OAuth2 dispatch confirmed. Verified messageId: ${verifiedRefId}`
      : `Event dispatched for email ${lead.email || 'lead@company.com'}: ${result.errorText || 'Awaiting provider receipt'}`;

    const providerReceipt = {
      provider: 'Google Workspace Gmail API (OAuth2)',
      http_status: result.status,
      external_ref_id: verifiedRefId,
      details,
      messageId: messageId || null
    };

    // Log action to Supabase ai_actions table
    await logAiActionToSupabase({
      agent_name: 'Gmail API',
      action_type: 'proposal_generated',
      target_lead_id: lead.id,
      payload: {
        step: '3. Gmail Proposal Dispatch',
        email: lead.email,
        contactName: lead.contactName,
        companyName: lead.companyName,
        subject,
        delivery_id: verifiedRefId,
        messageId: messageId || null,
        delivery_status: deliveryStatus,
        provider_receipt: providerReceipt,
        is_live_external: isLive
      },
      status: isLive ? 'success' : (result.ok ? 'pending' : 'failed')
    });

    return {
      success: isLive || result.ok,
      httpStatus: result.status,
      isLive,
      messageId: messageId || undefined,
      deliveryStatus,
      details,
      rawResponse: result.data,
      error: result.ok ? undefined : result.errorText
    };
  }

  /**
   * Dispatch Google Calendar Discovery Session Event via n8n
   */
  async dispatchCalendar(
    lead: Lead,
    customTitle?: string,
    webhookUrl?: string
  ): Promise<N8NExecutionResponse> {
    const targetUrl = webhookUrl || this.defaultWebhookUrl;
    const eventTitle = customTitle || `AI Strategy Session: ${lead.companyName} x ZA Media`;

    const payload = {
      event: 'google_calendar.event_create',
      timestamp: new Date().toISOString(),
      lead_id: lead.id,
      companyName: lead.companyName,
      contactName: lead.contactName,
      email: lead.email,
      eventTitle,
      scheduledTime: 'Tomorrow at 10:00 AM UTC'
    };

    const result = await this.postToN8nProxy(targetUrl, payload);

    // Extract verified eventId ONLY if actually returned by provider
    const data = result.data || {};
    const eventId = data.eventId || data.event_id;
    const isLive = result.ok && !result.simulated && Boolean(eventId);

    const verifiedRefId = eventId || 'UNVERIFIED_NO_PROVIDER_ID';
    const deliveryStatus = isLive
      ? (data.deliveryStatus || `Event Created in Google Calendar (eventId: ${eventId})`)
      : (result.ok ? 'Dispatched - Awaiting Provider Confirmation' : `Calendar Booking Failed: ${result.errorText || 'Unknown Error'}`);

    const details = isLive
      ? `Live Google Calendar Event confirmed. Verified eventId: ${verifiedRefId}`
      : `Event dispatched for ${lead.contactName}: ${result.errorText || 'Awaiting provider receipt'}`;

    const providerReceipt = {
      provider: 'Google Calendar API v3',
      http_status: result.status,
      external_ref_id: verifiedRefId,
      details,
      eventId: eventId || null
    };

    // Log action to Supabase ai_actions table
    await logAiActionToSupabase({
      agent_name: 'Google Calendar API',
      action_type: 'proposal_generated',
      target_lead_id: lead.id,
      payload: {
        step: '4. Calendar Discovery Meeting Booking',
        contactName: lead.contactName,
        companyName: lead.companyName,
        eventTitle,
        delivery_id: verifiedRefId,
        eventId: eventId || null,
        delivery_status: deliveryStatus,
        provider_receipt: providerReceipt,
        is_live_external: isLive
      },
      status: isLive ? 'success' : (result.ok ? 'pending' : 'failed')
    });

    return {
      success: isLive || result.ok,
      httpStatus: result.status,
      isLive,
      eventId: eventId || undefined,
      deliveryStatus,
      details,
      rawResponse: result.data,
      error: result.ok ? undefined : result.errorText
    };
  }

  /**
   * Dispatch Inbound Lead Intake to n8n Webhook for automated qualification & workflow orchestration
   */
  async dispatchLeadIntake(
    lead: Lead,
    webhookUrl?: string
  ): Promise<N8NExecutionResponse> {
    const targetUrl = webhookUrl || this.defaultWebhookUrl;
    if (!targetUrl) {
      return {
        success: false,
        httpStatus: 0,
        isLive: false,
        deliveryStatus: 'Not configured',
        details: 'n8n webhook URL is not configured on the server.',
        error: 'N8N_WEBHOOK_URL is required.'
      };
    }

    const payload = {
      event: 'lead_intake',
      timestamp: new Date().toISOString(),
      lead: {
        id: lead.id,
        fullName: lead.contactName,
        contactName: lead.contactName,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        industry: lead.industry,
        source: lead.source,
        monthlyBudget: lead.monthlyBudget,
        estimatedValue: lead.estimatedValue,
        notes: lead.notes,
        status: lead.status,
        stage: lead.stage
      }
    };

    const result = await this.postToN8nProxy(targetUrl, payload);
    const data = result.data || {};
    const deliveryStatus = result.ok 
      ? 'Inbound Lead Queued for n8n Orchestration' 
      : `Lead Dispatch Failed: ${result.errorText}`;

    await logAiActionToSupabase({
      agent_name: 'n8n Lead Intake Orchestrator',
      action_type: 'lead_intake_dispatched',
      target_lead_id: lead.id,
      payload: {
        companyName: lead.companyName,
        email: lead.email,
        source: lead.source,
        target_url: targetUrl,
        status: result.ok ? 'dispatched' : 'failed'
      },
      status: result.ok ? 'success' : 'failed'
    });

    return {
      success: result.ok,
      httpStatus: result.status,
      isLive: result.ok && !result.simulated,
      deliveryStatus,
      details: result.ok ? `Lead intake sent to n8n at ${targetUrl}` : `Dispatch error: ${result.errorText}`,
      rawResponse: data,
      error: result.ok ? undefined : result.errorText
    };
  }
}

export const n8nService = new N8NIntegrationService();
