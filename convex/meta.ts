import { v } from "convex/values";
import { action, httpAction, internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { resolveMetaGraphApiVersion } from "./metaVersion.js";
import { metaWebhookResponse } from "./metaWebhookResponse.js";
import { BLOCKED_FULL_RETENTION_MS, EVENT_TTL_MS, MAX_TRANSIENT_ATTEMPTS, PROCESSING_LEASE_MS, SWEEP_BATCH_SIZE, TERMINAL_RETENTION_MS, isProcessingLeaseExpired, retryDelayMs, shouldRetryTransientFailure, sweepIsOverdue, terminalReasonForExpiredEvent } from "./metaEventPolicy.js";

const BLOCKED_PAGE_IDS = new Set(["179969831856298"]);
const BLOCKED_FORM_IDS = new Set(["1117890449167883"]);
const GRAPH_API_VERSION = resolveMetaGraphApiVersion();

async function hmacSha256Hex(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function fieldMap(fieldData: unknown) {
  const map: Record<string, string> = {};
  for (const field of Array.isArray(fieldData) ? fieldData : []) {
    if (!field || typeof field !== "object") continue;
    const name = text((field as any).name).toLowerCase();
    const values = (field as any).values;
    const value = Array.isArray(values) ? text(values[0]) : text(values);
    if (name && value) map[name] = value;
  }
  return map;
}
function pick(map: Record<string, string>, names: string[]) { for (const name of names) if (map[name]) return map[name]; return ""; }
async function retrieveLead(leadgenId: string, pageAccessToken: string) {
  const url = new URL("https://graph.facebook.com/" + GRAPH_API_VERSION + "/" + encodeURIComponent(leadgenId));
  url.searchParams.set("fields", "id,created_time,field_data,ad_id,form_id,campaign_id");
  url.searchParams.set("access_token", pageAccessToken);
  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) { const errorText = await response.text(); throw new Error("META_LEAD_RETRIEVAL_FAILED:" + response.status + ":" + errorText.slice(0, 500)); }
  return await response.json();
}

export const enqueueWebhookEvent = internalMutation({
  args: { page_id: v.string(), leadgen_id: v.string(), form_id: v.string(), created_time: v.string(), received_at: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const eventKey = "meta:" + args.page_id + ":" + args.leadgen_id;
    const existing = await ctx.db.query("meta_webhook_events").withIndex("by_event_key", (q: any) => q.eq("event_key", eventKey)).unique();
    const connection = await ctx.db.query("meta_connections").withIndex("by_page", (q: any) => q.eq("page_id", args.page_id)).unique();
    const policyBlockReason = BLOCKED_PAGE_IDS.has(args.page_id) ? "BLOCKED_PAGE_ID" : BLOCKED_FORM_IDS.has(args.form_id) ? "BLOCKED_FORM_ID" : "";
    const connectionVerified = connection?.status === "verified";
    const connectionVerifiedAt = connection?.status === "verified" ? connection.verified_at : undefined;
    const verifiedAfterReceipt = typeof connectionVerifiedAt === "number" && connectionVerifiedAt >= args.received_at ? connectionVerifiedAt : undefined;
    if (existing) {
      if (existing.status === "processed" || existing.status === "abandoned" || (existing.status === "blocked" && existing.terminal_reason !== "NO_VERIFIED_META_CONNECTION")) {
        return { shouldRetrieve: false, status: existing.status, duplicate: true, event_key: eventKey };
      }
      if (existing.status === "processing" && !isProcessingLeaseExpired(existing.lease_started_at, now)) {
        return { shouldRetrieve: false, status: "processing", retryable: true, event_key: eventKey };
      }
      if (existing.status === "pending" && existing.next_attempt_at > now) {
        return { shouldRetrieve: false, status: "pending", retryable: true, event_key: eventKey };
      }
      if (policyBlockReason) {
        await ctx.db.patch(existing._id, { status: "blocked", terminal_at: now, terminal_reason: policyBlockReason, lease_started_at: undefined, last_error: policyBlockReason, updated_at: now, workspace_id: connection?.workspace_id });
        await ctx.db.insert("audit_logs", { workspace_id: connection?.workspace_id ?? "unmapped", action: "meta_webhook_blocked", entity_type: "meta_webhook_event", entity_id: existing._id.toString(), actor: "meta-webhook", details: { reason: policyBlockReason, event_key: eventKey }, created_at: new Date(now).toISOString() });
        return { shouldRetrieve: false, status: "blocked", durable: true, event_key: eventKey };
      }
      if (!connectionVerified) {
        await ctx.db.patch(existing._id, { status: "pending", next_attempt_at: now + retryDelayMs(Math.max(1, existing.attempt_count + 1)), terminal_at: undefined, terminal_reason: undefined, lease_started_at: undefined, last_error: "NO_VERIFIED_META_CONNECTION", updated_at: now });
        return { shouldRetrieve: false, status: "pending", retryable: true, durable: true, event_key: eventKey };
      }
      if (existing.attempt_count >= MAX_TRANSIENT_ATTEMPTS) {
        await ctx.db.patch(existing._id, { status: "abandoned", terminal_at: now, terminal_reason: "MAX_TRANSIENT_ATTEMPTS", lease_started_at: undefined, updated_at: now });
        return { shouldRetrieve: false, status: "abandoned", durable: true, event_key: eventKey };
      }
      const verifiedAfterOriginalReceipt = typeof connectionVerifiedAt === "number" && connectionVerifiedAt >= existing.received_at ? connectionVerifiedAt : existing.last_verified_at;
      await ctx.db.patch(existing._id, { status: "processing", attempt_count: existing.attempt_count + 1, lease_started_at: now, next_attempt_at: now, terminal_at: undefined, terminal_reason: undefined, last_verified_at: verifiedAfterOriginalReceipt, last_error: undefined, updated_at: now, workspace_id: connection!.workspace_id });
      return { shouldRetrieve: true, status: "processing", event_key: eventKey };
    }
    const status = policyBlockReason ? "blocked" : connectionVerified ? "processing" : "pending";
    const eventId = await ctx.db.insert("meta_webhook_events", {
      event_key: eventKey, page_id: args.page_id, leadgen_id: args.leadgen_id, form_id: args.form_id || undefined, created_time: args.created_time || undefined,
      workspace_id: connection?.workspace_id, status, received_at: args.received_at, attempt_count: policyBlockReason ? 0 : connectionVerified ? 1 : 0,
      next_attempt_at: connectionVerified ? now : now + retryDelayMs(1), lease_started_at: connectionVerified ? now : undefined, terminal_at: policyBlockReason ? now : undefined,
      terminal_reason: policyBlockReason || undefined, last_error: policyBlockReason || (!connectionVerified ? "NO_VERIFIED_META_CONNECTION" : undefined), last_verified_at: connectionVerified ? verifiedAfterReceipt : undefined,
      created_at: now, updated_at: now,
    });
    if (policyBlockReason) {
      await ctx.db.insert("audit_logs", { workspace_id: connection?.workspace_id ?? "unmapped", action: "meta_webhook_blocked", entity_type: "meta_webhook_event", entity_id: eventId.toString(), actor: "meta-webhook", details: { reason: policyBlockReason, event_key: eventKey }, created_at: new Date(now).toISOString() });
      return { shouldRetrieve: false, status: "blocked", durable: true, event_key: eventKey };
    }
    if (!connectionVerified) return { shouldRetrieve: false, status: "pending", retryable: true, durable: true, event_key: eventKey };
    return { shouldRetrieve: true, status: "processing", event_key: eventKey };
  },
});

export const markWebhookFailure = internalMutation({
  args: { event_key: v.string(), error_kind: v.string(), transient: v.boolean() },
  handler: async (ctx, args) => {
    const event = await ctx.db.query("meta_webhook_events").withIndex("by_event_key", (q: any) => q.eq("event_key", args.event_key)).unique();
    if (!event || event.status !== "processing") return { ok: false, reason: "EVENT_NOT_PROCESSING" };
    const now = Date.now();
    const verificationPending = args.error_kind === "NO_VERIFIED_META_CONNECTION";
    const canRetry = verificationPending || (args.transient && shouldRetryTransientFailure(event.attempt_count));
    const delay = canRetry ? retryDelayMs(event.attempt_count) : 0;
    const nextStatus = canRetry ? "pending" : (args.transient ? "abandoned" : "blocked");
    await ctx.db.patch(event._id, {
      status: nextStatus,
      next_attempt_at: canRetry ? now + delay : event.next_attempt_at,
      lease_started_at: undefined,
      terminal_at: canRetry ? undefined : now,
      terminal_reason: canRetry ? undefined : (args.transient ? "MAX_TRANSIENT_ATTEMPTS" : args.error_kind),
      last_error: args.error_kind.slice(0, 80),
      updated_at: now,
    });
    if (!canRetry) await ctx.db.insert("audit_logs", { workspace_id: event.workspace_id ?? "unmapped", action: nextStatus === "blocked" ? "meta_webhook_blocked" : "meta_webhook_abandoned", entity_type: "meta_webhook_event", entity_id: event._id.toString(), actor: "meta-webhook", details: { reason: args.error_kind.slice(0, 80), event_key: event.event_key }, created_at: new Date(now).toISOString() });
    return { ok: true, status: nextStatus, retry_at: canRetry ? now + delay : undefined };
  },
});

export const claimDueWebhookEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db.query("meta_webhook_events").withIndex("by_status_next_attempt", (q: any) => q.eq("status", "pending").lte("next_attempt_at", now)).take(SWEEP_BATCH_SIZE);
    const processing = await ctx.db.query("meta_webhook_events").withIndex("by_status_next_attempt", (q: any) => q.eq("status", "processing").lte("next_attempt_at", now - PROCESSING_LEASE_MS)).take(SWEEP_BATCH_SIZE);
    const candidates = [...pending, ...processing].sort((a, b) => a.next_attempt_at - b.next_attempt_at || a.received_at - b.received_at || String(a._id).localeCompare(String(b._id))).slice(0, SWEEP_BATCH_SIZE);
    const claimed: Array<{ event_key: string; page_id: string; leadgen_id: string; form_id: string; created_time: string }> = [];
    let expired = 0;
    for (const candidate of candidates) {
      const current = await ctx.db.get(candidate._id);
      if (!current || (current.status !== "pending" && current.status !== "processing")) continue;
      if (current.status === "processing" && !isProcessingLeaseExpired(current.lease_started_at, now)) continue;
      if (now - current.received_at >= EVENT_TTL_MS) {
        const reason = terminalReasonForExpiredEvent(current.received_at, current.last_verified_at ?? null);
        await ctx.db.patch(current._id, { status: "abandoned", terminal_at: now, terminal_reason: reason, lease_started_at: undefined, last_error: undefined, updated_at: now });
        expired++;
        continue;
      }
      const connection = await ctx.db.query("meta_connections").withIndex("by_page", (q: any) => q.eq("page_id", current.page_id)).unique();
      const policyBlockReason = BLOCKED_PAGE_IDS.has(current.page_id) ? "BLOCKED_PAGE_ID" : BLOCKED_FORM_IDS.has(current.form_id ?? "") ? "BLOCKED_FORM_ID" : "";
      if (policyBlockReason) {
        await ctx.db.patch(current._id, { status: "blocked", terminal_at: now, terminal_reason: policyBlockReason, lease_started_at: undefined, last_error: policyBlockReason, updated_at: now });
        await ctx.db.insert("audit_logs", { workspace_id: connection?.workspace_id ?? current.workspace_id ?? "unmapped", action: "meta_webhook_blocked", entity_type: "meta_webhook_event", entity_id: current._id.toString(), actor: "meta-webhook-sweeper", details: { reason: policyBlockReason, event_key: current.event_key }, created_at: new Date(now).toISOString() });
        continue;
      }
      if (!connection || connection.status !== "verified") {
        await ctx.db.patch(current._id, { status: "pending", next_attempt_at: now + retryDelayMs(Math.max(1, current.attempt_count + 1)), terminal_at: undefined, terminal_reason: undefined, lease_started_at: undefined, last_error: "NO_VERIFIED_META_CONNECTION", updated_at: now });
        continue;
      }
      if (current.attempt_count >= MAX_TRANSIENT_ATTEMPTS) {
        await ctx.db.patch(current._id, { status: "abandoned", terminal_at: now, terminal_reason: "MAX_TRANSIENT_ATTEMPTS", lease_started_at: undefined, updated_at: now });
        continue;
      }
      const verifiedAt = connection.verified_at;
      const verifiedAfterReceipt = typeof verifiedAt === "number" && verifiedAt >= current.received_at ? verifiedAt : current.last_verified_at;
      await ctx.db.patch(current._id, { status: "processing", attempt_count: current.attempt_count + 1, lease_started_at: now, next_attempt_at: now, last_verified_at: verifiedAfterReceipt, last_error: undefined, workspace_id: connection!.workspace_id, updated_at: now });
      claimed.push({ event_key: current.event_key, page_id: current.page_id, leadgen_id: current.leadgen_id, form_id: current.form_id ?? "", created_time: current.created_time ?? "" });
    }
    let terminalDeleted = 0;
    for (const status of ["processed", "abandoned"] as const) {
      const oldTerminal = await ctx.db.query("meta_webhook_events").withIndex("by_status_terminal", (q: any) => q.eq("status", status).lte("terminal_at", now - TERMINAL_RETENTION_MS)).take(SWEEP_BATCH_SIZE);
      for (const event of oldTerminal) { await ctx.db.delete(event._id); terminalDeleted++; }
    }
    const oldBlocked = await ctx.db.query("meta_webhook_events").withIndex("by_status_terminal", (q: any) => q.eq("status", "blocked").lte("terminal_at", now - BLOCKED_FULL_RETENTION_MS)).take(SWEEP_BATCH_SIZE);
    for (const event of oldBlocked) { await ctx.db.delete(event._id); terminalDeleted++; }
    // Business audit logs are intentionally not auto-deleted by the Meta sweeper.
    // Retention needs a separately approved, action-scoped policy; never sweep the shared audit_logs table broadly.
    return { claimed, examined: candidates.length, expired, terminalDeleted };
  },
});

export const recordSweepFailure = internalMutation({
  args: { error_kind: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const state = await ctx.db.query("meta_webhook_sweep_state").withIndex("by_singleton", (q: any) => q.eq("singleton_key", "meta-webhook")).unique();
    if (state) await ctx.db.patch(state._id, { consecutive_failures: state.consecutive_failures + 1, last_error: args.error_kind.slice(0, 80), updated_at: now });
    else await ctx.db.insert("meta_webhook_sweep_state", { singleton_key: "meta-webhook", consecutive_failures: 1, last_error: args.error_kind.slice(0, 80), updated_at: now });
    return { ok: true, consecutive_failures: (state?.consecutive_failures ?? 0) + 1 };
  },
});

export const recordSweepSuccess = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const state = await ctx.db.query("meta_webhook_sweep_state").withIndex("by_singleton", (q: any) => q.eq("singleton_key", "meta-webhook")).unique();
    if (state) await ctx.db.patch(state._id, { last_sweep_at: now, consecutive_failures: 0, last_error: undefined, updated_at: now });
    else await ctx.db.insert("meta_webhook_sweep_state", { singleton_key: "meta-webhook", last_sweep_at: now, consecutive_failures: 0, updated_at: now });
    return { ok: true, last_sweep_at: now, overdue: false };
  },
});

export const webhookSweepHealth = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const state = await ctx.db.query("meta_webhook_sweep_state").withIndex("by_singleton", (q: any) => q.eq("singleton_key", "meta-webhook")).unique();
    const consecutiveFailures = state?.consecutive_failures ?? 0;
    return {
      status: sweepIsOverdue({ lastSweepAt: state?.last_sweep_at, consecutiveFailures }, now) ? "OVERDUE" : "HEALTHY",
      last_sweep_at: state?.last_sweep_at ?? null,
      consecutive_failures: consecutiveFailures,
      never_successful_repeated_failure: state?.last_sweep_at === undefined && consecutiveFailures > 0,
      last_error: state?.last_error ?? null,
    };
  },
});

export const sweepWebhookEvents = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; reason?: string; examined?: number; claimed?: number; failed?: number; expired?: number }> => {
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) {
      await ctx.runMutation(internal.meta.recordSweepFailure, { error_kind: "META_PAGE_ACCESS_TOKEN_MISSING" });
      return { ok: false, reason: "META_PAGE_ACCESS_TOKEN_MISSING" };
    }
    try {
      const batch: { claimed: Array<{ event_key: string; page_id: string; leadgen_id: string; form_id: string; created_time: string }>; examined: number; expired: number; terminalDeleted: number } = await ctx.runMutation(internal.meta.claimDueWebhookEvents, {});
      let failed = 0;
      for (const event of batch.claimed) {
        try {
          const retrievedLead = await retrieveLead(event.leadgen_id, pageAccessToken);
          const result = await ctx.runMutation(internal.meta.recordWebhook, { page_id: event.page_id, leadgen_id: event.leadgen_id, form_id: event.form_id, created_time: event.created_time || String(retrievedLead?.created_time ?? ""), retrieved_lead: retrievedLead });
          if (!result?.ok) { failed++; const reason = typeof result?.reason === "string" ? result.reason : "PERSISTENCE_REJECTED"; await ctx.runMutation(internal.meta.markWebhookFailure, { event_key: event.event_key, error_kind: reason, transient: reason === "NO_VERIFIED_META_CONNECTION" }); }
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : "META_LEAD_RETRIEVAL_FAILED";
          const match = message.match(/META_LEAD_RETRIEVAL_FAILED:(\d{3})/);
          const status = match ? Number(match[1]) : 0;
          const transient = status === 0 || status === 408 || status === 429 || status >= 500;
          await ctx.runMutation(internal.meta.markWebhookFailure, { event_key: event.event_key, error_kind: status ? "META_HTTP_" + status : "META_NETWORK_FAILURE", transient });
        }
      }
      if (failed > 0) {
        await ctx.runMutation(internal.meta.recordSweepFailure, { error_kind: "BATCH_ITEMS_FAILED" });
        return { ok: false, examined: batch.examined, claimed: batch.claimed.length, failed, expired: batch.expired };
      }
      await ctx.runMutation(internal.meta.recordSweepSuccess, {});
      return { ok: true, examined: batch.examined, claimed: batch.claimed.length, failed: 0, expired: batch.expired };
    } catch {
      await ctx.runMutation(internal.meta.recordSweepFailure, { error_kind: "SWEEP_EXECUTION_FAILED" });
      return { ok: false, reason: "SWEEP_EXECUTION_FAILED" };
    }
  },
});
export const recordWebhook = internalMutation({
  args: { page_id: v.string(), leadgen_id: v.string(), form_id: v.string(), created_time: v.string(), retrieved_lead: v.optional(v.any()) },
  handler: async (ctx, args) => {
    const connection = await ctx.db.query("meta_connections").withIndex("by_page", (q: any) => q.eq("page_id", args.page_id)).unique();
    const idempotencyKey = "meta:" + args.page_id + ":" + args.leadgen_id;
    const webhookEvent = await ctx.db.query("meta_webhook_events").withIndex("by_event_key", (q: any) => q.eq("event_key", idempotencyKey)).unique();
    if (!webhookEvent) return { ok: false, reason: "EVENT_NOT_ENQUEUED" };
    const policyBlockReason = BLOCKED_PAGE_IDS.has(args.page_id) ? "BLOCKED_PAGE_ID" : BLOCKED_FORM_IDS.has(args.form_id) ? "BLOCKED_FORM_ID" : "";
    if (policyBlockReason) {
      if (webhookEvent && webhookEvent.status !== "processed") await ctx.db.patch(webhookEvent._id, { status: "blocked", terminal_at: Date.now(), terminal_reason: policyBlockReason, lease_started_at: undefined, last_error: policyBlockReason, updated_at: Date.now() });
      await ctx.db.insert("audit_logs", { workspace_id: connection?.workspace_id ?? "unmapped", action: "meta_webhook_rejected", entity_type: "meta_webhook", actor: "meta-webhook", details: { reason: policyBlockReason, event_key: idempotencyKey }, created_at: new Date().toISOString() });
      return { ok: false, reason: policyBlockReason };
    }
    if (!connection || connection.status !== "verified") {
      if (webhookEvent && webhookEvent.status !== "processed") await ctx.db.patch(webhookEvent._id, { status: "pending", next_attempt_at: Date.now() + retryDelayMs(Math.max(1, webhookEvent.attempt_count)), terminal_at: undefined, terminal_reason: undefined, lease_started_at: undefined, last_error: "NO_VERIFIED_META_CONNECTION", updated_at: Date.now() });
      return { ok: false, reason: "NO_VERIFIED_META_CONNECTION" };
    }
    if (webhookEvent && webhookEvent.status !== "processing") {
      return { ok: webhookEvent.status === "processed", duplicate: true, reason: webhookEvent.status === "blocked" ? "BLOCKED_EVENT" : "EVENT_NOT_PROCESSING" };
    }
    const existingLead = await ctx.db.query("leads").withIndex("by_idempotency", (q: any) => q.eq("idempotency_key", idempotencyKey)).unique();
    if (existingLead) {
      if (webhookEvent) await ctx.db.patch(webhookEvent._id, { status: "processed", terminal_at: Date.now(), terminal_reason: "DUPLICATE_LEAD_EXISTS", lease_started_at: undefined, updated_at: Date.now() });
      return { ok: true, duplicate: true, lead_id: existingLead._id.toString() };
    }


    const lead = args.retrieved_lead ?? {};
    const fields = fieldMap(lead.field_data);
    const email = pick(fields, ["email", "e-mail", "email_address"]);
    const phone = pick(fields, ["phone_number", "phone", "mobile", "mobile_number"]);
    const fullName = pick(fields, ["full_name", "name", "contact_name"]);
    const companyName = pick(fields, ["company_name", "business_name", "company", "organization"]);
    const website = pick(fields, ["website", "company_website", "url"]);
    const industry = pick(fields, ["industry", "business_industry"]) || "unspecified";
    const country = pick(fields, ["country", "country_name", "location_country"]) || "unspecified";
    const jobTitle = pick(fields, ["job_title", "title", "role"]);
    const now = new Date().toISOString();

    const evidenceId = await ctx.db.insert("audit_logs", { workspace_id: connection.workspace_id, action: "meta_webhook_received", entity_type: "meta_lead_evidence", actor: "meta-webhook", details: { leadgen_id: args.leadgen_id, page_id: args.page_id, form_id: args.form_id, created_time: args.created_time, evidence_status: "received_signature_verified_and_retrieved", outreach_eligible: false, fields_present: { email: !!email, phone: !!phone, full_name: !!fullName, company_name: !!companyName } }, created_at: now });

    if (!email || !phone || !fullName || !companyName) {
      await ctx.db.insert("audit_logs", { workspace_id: connection.workspace_id, action: "meta_lead_not_promoted", entity_type: "meta_lead_evidence", entity_id: evidenceId.toString(), actor: "meta-webhook", details: { reason: "required_fields_missing", leadgen_id: args.leadgen_id, required: ["full_name", "company_name", "email", "phone"], present: { full_name: !!fullName, company_name: !!companyName, email: !!email, phone: !!phone } }, created_at: now });
      await ctx.db.patch(webhookEvent._id, { status: "processed", terminal_at: Date.now(), terminal_reason: "REQUIRED_FIELDS_MISSING", lease_started_at: undefined, updated_at: Date.now() });
      return { ok: true, duplicate: false, evidence_id: evidenceId.toString(), promoted: false, reason: "REQUIRED_FIELDS_MISSING" };
    }

    const companyId = await ctx.db.insert("companies", { workspace_id: connection.workspace_id, name: companyName, domain: website || undefined, industry, country, created_at: now, updated_at: now });
    const contactId = await ctx.db.insert("contacts", { workspace_id: connection.workspace_id, company_id: companyId.toString(), full_name: fullName, email, phone, job_title: jobTitle, is_decision_maker: false, linkedin_url: pick(fields, ["linkedin", "linkedin_url"]) || undefined, created_at: now });
    const leadId = await ctx.db.insert("leads", { workspace_id: connection.workspace_id, company_id: companyId.toString(), contact_id: contactId.toString(), idempotency_key: idempotencyKey, contact_name: fullName, company_name: companyName, email, phone, source: "meta_leadgen", industry, monthly_budget: 0, estimated_value: 0, stage: "new", status: "qualified_pending_review", last_activity: now, notes: website ? "Website: " + website : undefined, assigned_agent: "za-meta-intake", automation_status: "evidence_verified_human_review_required", likes_count: 0, liked_by_me: false, created_at: now, updated_at: now });
    await ctx.db.insert("audit_logs", { workspace_id: connection.workspace_id, action: "meta_lead_promoted", entity_type: "lead", entity_id: leadId.toString(), actor: "meta-webhook", details: { leadgen_id: args.leadgen_id, evidence_id: evidenceId.toString(), outreach_eligible: false, reason: "retrieved_and_required_fields_present" }, created_at: now });
    await ctx.db.patch(webhookEvent._id, { status: "processed", terminal_at: Date.now(), terminal_reason: undefined, lease_started_at: undefined, last_error: undefined, updated_at: Date.now() });
    return { ok: true, duplicate: false, evidence_id: evidenceId.toString(), promoted: true, lead_id: leadId.toString() };
  },
});

export const reopenBlockedWebhookEvent = mutation({
  args: { event_key: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const reason = text(args.reason).slice(0, 200);
    if (!reason) throw new Error("Replay reason is required");
    const event = await ctx.db.query("meta_webhook_events").withIndex("by_event_key", (q: any) => q.eq("event_key", args.event_key)).unique();
    if (!event) throw new Error("Webhook event not found");
    const workspace = await ctx.db.query("workspaces").withIndex("by_owner", (q: any) => q.eq("ownerSubject", identity.subject)).unique();
    const connection = await ctx.db.query("meta_connections").withIndex("by_page", (q: any) => q.eq("page_id", event.page_id)).unique();
    if (!workspace || (event.workspace_id && workspace._id.toString() !== event.workspace_id) || (!event.workspace_id && (!connection || connection.workspace_id !== workspace._id.toString()))) throw new Error("Webhook event not found");
    const now = Date.now();
    const denial = event.status !== "blocked" ? "EVENT_NOT_BLOCKED"
      : now - event.received_at >= BLOCKED_FULL_RETENTION_MS ? "BLOCKED_RETENTION_EXPIRED"
      : BLOCKED_PAGE_IDS.has(event.page_id) ? "BLOCKED_PAGE_ID"
      : BLOCKED_FORM_IDS.has(event.form_id ?? "") ? "BLOCKED_FORM_ID"
      : !connection || connection.status !== "verified" ? "NO_VERIFIED_META_CONNECTION"
      : "";
    if (denial) {
      await ctx.db.insert("audit_logs", { workspace_id: event.workspace_id ?? connection?.workspace_id ?? workspace._id.toString(), action: "meta_webhook_replay_denied", entity_type: "meta_webhook_event", entity_id: event._id.toString(), actor: identity.subject, details: { reason: denial, event_key: event.event_key }, created_at: new Date(now).toISOString() });
      return { ok: false, reason: denial, status: event.status };
    }
    await ctx.db.patch(event._id, { status: "pending", attempt_count: 0, next_attempt_at: now, lease_started_at: undefined, terminal_at: undefined, terminal_reason: undefined, last_error: undefined, workspace_id: connection!.workspace_id, updated_at: now });
    await ctx.db.insert("audit_logs", { workspace_id: event.workspace_id ?? connection!.workspace_id, action: "meta_webhook_reopened", entity_type: "meta_webhook_event", entity_id: event._id.toString(), actor: identity.subject, details: { reason, previous_attempt_count: event.attempt_count, event_key: event.event_key }, created_at: new Date(now).toISOString() });
    return { ok: true, status: "pending", event_key: event.event_key };
  },
});

export const getMetaConnectionForVerification = internalQuery({
  args: { connection_id: v.id("meta_connections"), owner_subject: v.string() },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.query("workspaces").withIndex("by_owner", (q: any) => q.eq("ownerSubject", args.owner_subject)).unique();
    if (!workspace) return null;
    const connection = await ctx.db.get(args.connection_id);
    if (!connection || connection.workspace_id !== workspace._id.toString() || !connection.page_id || connection.status === "revoked" || BLOCKED_PAGE_IDS.has(connection.page_id)) return null;
    return { page_id: connection.page_id, workspace_id: connection.workspace_id, status: connection.status };
  },
});

export const markMetaConnectionVerified = internalMutation({
  args: { connection_id: v.id("meta_connections"), page_id: v.string(), owner_subject: v.string(), verified_at: v.number() },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.query("workspaces").withIndex("by_owner", (q: any) => q.eq("ownerSubject", args.owner_subject)).unique();
    const connection = await ctx.db.get(args.connection_id);
    if (!workspace || !connection || connection.workspace_id !== workspace._id.toString() || connection.page_id !== args.page_id || connection.status === "revoked") {
      throw new Error("Meta connection changed during verification");
    }
    const updatedAt = new Date(args.verified_at).toISOString();
    await ctx.db.patch(connection._id, { status: "verified", verified_at: args.verified_at, updated_at: updatedAt });
    await ctx.db.insert("audit_logs", { workspace_id: connection.workspace_id, action: "meta_connection_verified", entity_type: "meta_connection", entity_id: connection._id.toString(), actor: args.owner_subject, details: { page_id: args.page_id, verified_at: args.verified_at }, created_at: updatedAt });
    return { ok: true, page_id: args.page_id, verified_at: args.verified_at };
  },
});

export const verifyMetaConnection = action({
  args: { connection_id: v.id("meta_connections") },
  handler: async (ctx, args): Promise<{ ok: boolean; page_id: string; verified_at: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const connection = await ctx.runQuery(internal.meta.getMetaConnectionForVerification, { connection_id: args.connection_id, owner_subject: identity.subject });
    if (!connection) throw new Error("Meta connection not found");
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) throw new Error("META_PAGE_ACCESS_TOKEN_MISSING");
    const url = new URL("https://graph.facebook.com/" + GRAPH_API_VERSION + "/me");
    url.searchParams.set("fields", "id");
    url.searchParams.set("access_token", pageAccessToken);
    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) throw new Error("META_CONNECTION_VERIFICATION_FAILED");
    const result: any = await response.json();
    if (String(result?.id ?? "") !== connection.page_id) throw new Error("META_PAGE_ID_MISMATCH");
    const verifiedAt = Date.now();
    return await ctx.runMutation(internal.meta.markMetaConnectionVerified, {
      connection_id: args.connection_id, page_id: connection.page_id, owner_subject: identity.subject, verified_at: verifiedAt,
    });
  },
});

export const revokeMetaConnection = mutation({
  args: { connection_id: v.id("meta_connections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const workspace = await ctx.db.query("workspaces").withIndex("by_owner", (q: any) => q.eq("ownerSubject", identity.subject)).unique();
    const connection = await ctx.db.get(args.connection_id);
    if (!workspace || !connection || connection.workspace_id !== workspace._id.toString()) throw new Error("Meta connection not found");
    const now = new Date().toISOString();
    await ctx.db.patch(connection._id, { status: "revoked", verified_at: undefined, updated_at: now });
    await ctx.db.insert("audit_logs", { workspace_id: connection.workspace_id, action: "meta_connection_revoked", entity_type: "meta_connection", entity_id: connection._id.toString(), actor: identity.subject, details: { page_id: connection.page_id ?? null }, created_at: now });
    return true;
  },
});

export const webhook = httpAction(async (ctx, request) => {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const verifyToken = process.env.META_VERIFY_TOKEN;
    if (!verifyToken) return new Response("META_VERIFY_TOKEN not configured", { status: 503 });
    if (url.searchParams.get("hub.mode") !== "subscribe" || url.searchParams.get("hub.verify_token") !== verifyToken) return new Response("Forbidden", { status: 403 });
    const challenge = url.searchParams.get("hub.challenge");
    return challenge ? new Response(challenge, { status: 200 }) : new Response("Missing challenge", { status: 400 });
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const appSecret = process.env.META_APP_SECRET;
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!appSecret) return new Response("META_APP_SECRET not configured", { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!signature.startsWith("sha256=")) return new Response("Invalid signature", { status: 401 });
  const expected = await hmacSha256Hex(rawBody, appSecret);
  if (!safeEqual(expected, signature.slice(7).toLowerCase())) return new Response("Invalid signature", { status: 401 });
  let body: any;
  try { body = JSON.parse(rawBody); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (body.object !== "page") return Response.json({ accepted: true, ignored: true });
  const results = [];
  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== "leadgen") continue;
      const value = change.value ?? {};
      const pageId = String(value.page_id ?? entry.id ?? "");
      const leadgenId = String(value.leadgen_id ?? "");
      const formId = String(value.form_id ?? "");
      if (!pageId || !leadgenId) {
        results.push({ ok: false, leadgen_id: leadgenId, reason: "MISSING_REQUIRED_FIELDS", retryable: false });
        continue;
      }
      const eventKey = "meta:" + pageId + ":" + leadgenId;
      try {
        const queued = await ctx.runMutation(internal.meta.enqueueWebhookEvent, { page_id: pageId, leadgen_id: leadgenId, form_id: formId, created_time: String(value.created_time ?? ""), received_at: Date.now() });
        if (!queued.shouldRetrieve) {
          const durable = queued.durable === true || ["processed", "blocked", "abandoned", "pending", "processing"].includes(queued.status);
          results.push({ ok: durable, duplicate: !!queued.duplicate, leadgen_id: leadgenId, reason: queued.status, retryable: !!queued.retryable, durable });
          continue;
        }
        if (!pageAccessToken) {
          await ctx.runMutation(internal.meta.markWebhookFailure, { event_key: eventKey, error_kind: "META_PAGE_ACCESS_TOKEN_MISSING", transient: true });
          results.push({ ok: false, leadgen_id: leadgenId, reason: "META_PAGE_ACCESS_TOKEN_MISSING", retryable: true, durable: true });
          continue;
        }
        const retrievedLead = await retrieveLead(leadgenId, pageAccessToken);
        results.push(await ctx.runMutation(internal.meta.recordWebhook, { page_id: pageId, leadgen_id: leadgenId, form_id: formId, created_time: String(value.created_time ?? retrievedLead?.created_time ?? ""), retrieved_lead: retrievedLead }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "META_LEAD_RETRIEVAL_FAILED";
        const statusMatch = message.match(/META_LEAD_RETRIEVAL_FAILED:(\d{3})/);
        const httpStatus = statusMatch ? Number(statusMatch[1]) : 0;
        const transient = httpStatus === 0 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500;
        try {
          const persisted = await ctx.runMutation(internal.meta.markWebhookFailure, { event_key: eventKey, error_kind: httpStatus ? "META_HTTP_" + httpStatus : "META_NETWORK_FAILURE", transient });
          results.push({ ok: !transient && persisted.ok, leadgen_id: leadgenId, reason: persisted.status ?? "META_LEAD_RETRIEVAL_FAILED", retryable: transient, durable: persisted.ok });
        } catch {
          results.push({ ok: false, leadgen_id: leadgenId, reason: "EVENT_STATE_PERSISTENCE_FAILED", retryable: true, durable: false });
        }
      }
    }
  }
  // Successful items are idempotent, so retrying a mixed batch is safe.
  return metaWebhookResponse(results);
});
