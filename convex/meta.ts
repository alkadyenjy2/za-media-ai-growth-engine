import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { resolveMetaGraphApiVersion } from "./metaVersion.js";
import { isRetryableMetaWebhookError } from "./metaRetry.js";

const BLOCKED_PAGE_IDS = new Set(["179969831856298"]);
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
  if (!response.ok) {
    // Never surface raw Graph API error bodies through the public webhook.
    await response.text().catch(() => {});
    throw new Error("META_LEAD_RETRIEVAL_FAILED:" + response.status + ":upstream_error");
  }
  return await response.json();
}

export const recordWebhookReceipt = internalMutation({
  args: { page_id: v.string(), leadgen_id: v.string(), form_id: v.string(), created_time: v.string(), raw_payload: v.any() },
  handler: async (ctx, args) => {
    const event_key = args.page_id + ":" + args.leadgen_id;
    const existing = await ctx.db.query("meta_webhook_events").withIndex("by_event_key", (q: any) => q.eq("event_key", event_key)).unique();
    if (existing?.status === "processed") return { ok: true, duplicate: true, status: "processed", event_key };
    const nowMs = Date.now();
    const existingIsFreshlyProcessing = existing?.status === "processing" && nowMs - Date.parse(existing.updated_at) < 5 * 60 * 1000;
    if (existingIsFreshlyProcessing) return { ok: false, duplicate: true, status: "processing", reason: "EVENT_PROCESSING", event_key };
    const connection = await ctx.db.query("meta_connections").withIndex("by_page", (q: any) => q.eq("page_id", args.page_id)).unique();
    const verified = !!connection && connection.status === "verified" && !BLOCKED_PAGE_IDS.has(args.page_id);
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: verified ? "processing" : "retryable_failed",
        attempts: existing.attempts + 1,
        workspace_id: connection?.workspace_id,
        last_error: verified ? undefined : "NO_VERIFIED_META_CONNECTION",
        updated_at: now,
      });
    } else {
      await ctx.db.insert("meta_webhook_events", {
        event_key, page_id: args.page_id, leadgen_id: args.leadgen_id, form_id: args.form_id,
        created_time: args.created_time, raw_payload: args.raw_payload,
        status: verified ? "processing" : "retryable_failed", attempts: 1,
        workspace_id: connection?.workspace_id, last_error: verified ? undefined : "NO_VERIFIED_META_CONNECTION",
        updated_at: now,
      });
    }
    if (!verified) return { ok: false, reason: BLOCKED_PAGE_IDS.has(args.page_id) ? "BLOCKED_PAGE_ID" : "NO_VERIFIED_META_CONNECTION", event_key };
    return { ok: true, duplicate: false, status: "processing", event_key };
  },
});

export const markWebhookStatus = internalMutation({
  args: { event_key: v.string(), status: v.union(v.literal("processed"), v.literal("retryable_failed"), v.literal("permanent_failed")), last_error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const event = await ctx.db.query("meta_webhook_events").withIndex("by_event_key", (q: any) => q.eq("event_key", args.event_key)).unique();
    if (!event) return { ok: false, reason: "EVENT_NOT_FOUND" };
    await ctx.db.patch(event._id, { status: args.status, last_error: args.last_error, updated_at: new Date().toISOString() });
    return { ok: true };
  },
});

export const checkWebhookConnection = internalQuery({
  args: { page_id: v.string() },
  handler: async (ctx, args) => {
    if (BLOCKED_PAGE_IDS.has(args.page_id)) return { ok: false, reason: "BLOCKED_PAGE_ID" };
    const connection = await ctx.db.query("meta_connections").withIndex("by_page", (q: any) => q.eq("page_id", args.page_id)).unique();
    if (!connection || connection.status !== "verified") return { ok: false, reason: "NO_VERIFIED_META_CONNECTION" };
    return { ok: true };
  },
});

export const recordWebhook = internalMutation({
  args: { page_id: v.string(), leadgen_id: v.string(), form_id: v.string(), created_time: v.string(), raw_payload: v.any(), retrieved_lead: v.optional(v.any()) },
  handler: async (ctx, args) => {
    const connection = await ctx.db.query("meta_connections").withIndex("by_page", (q: any) => q.eq("page_id", args.page_id)).unique();
    if (!connection || connection.status !== "verified") {
      await ctx.db.insert("audit_logs", { workspace_id: connection?.workspace_id ?? "unmapped", action: "meta_webhook_rejected", entity_type: "meta_webhook", actor: "meta-webhook", details: { reason: "no_verified_za_media_connection", page_id: args.page_id, leadgen_id: args.leadgen_id, form_id: args.form_id }, created_at: new Date().toISOString() });
      return { ok: false, reason: "NO_VERIFIED_META_CONNECTION" };
    }
    if (BLOCKED_PAGE_IDS.has(args.page_id)) return { ok: false, reason: "BLOCKED_PAGE_ID" };
    const pageScopedIdempotencyKey = "meta:" + args.page_id + ":" + args.leadgen_id;
    const existingLead = await ctx.db.query("leads").withIndex("by_idempotency", (q: any) => q.eq("idempotency_key", pageScopedIdempotencyKey)).unique();
    // Preserve deduplication for records created before page-scoped keys were introduced.
    const legacyLead = existingLead ? null : await ctx.db.query("leads").withIndex("by_idempotency", (q: any) => q.eq("idempotency_key", "meta:" + args.leadgen_id)).unique();
    const duplicateLead = existingLead ?? legacyLead;
    if (duplicateLead) return { ok: true, duplicate: true, lead_id: duplicateLead._id.toString(), retryable: false };

    const auditRows = await ctx.db.query("audit_logs").withIndex("by_workspace", (q: any) => q.eq("workspace_id", connection.workspace_id)).collect();
    const existing = auditRows.find((row: any) => row.action === "meta_webhook_received" && row.details?.leadgen_id === args.leadgen_id && row.details?.page_id === args.page_id);
    if (existing) return { ok: true, duplicate: true, evidence_id: existing._id.toString() };

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

    const evidenceId = await ctx.db.insert("audit_logs", { workspace_id: connection.workspace_id, action: "meta_webhook_received", entity_type: "meta_lead_evidence", actor: "meta-webhook", details: { leadgen_id: args.leadgen_id, page_id: args.page_id, form_id: args.form_id, created_time: args.created_time, raw_payload: args.raw_payload, retrieved_lead: lead, evidence_status: "received_signature_verified_and_retrieved", outreach_eligible: false }, created_at: now });

    if (!email || !phone || !fullName || !companyName) {
      await ctx.db.insert("audit_logs", { workspace_id: connection.workspace_id, action: "meta_lead_not_promoted", entity_type: "meta_lead_evidence", entity_id: evidenceId.toString(), actor: "meta-webhook", details: { reason: "required_fields_missing", leadgen_id: args.leadgen_id, required: ["full_name", "company_name", "email", "phone"], present: { full_name: !!fullName, company_name: !!companyName, email: !!email, phone: !!phone } }, created_at: now });
      return { ok: true, duplicate: false, evidence_id: evidenceId.toString(), promoted: false, reason: "REQUIRED_FIELDS_MISSING" };
    }

    const companyId = await ctx.db.insert("companies", { workspace_id: connection.workspace_id, name: companyName, domain: website || undefined, industry, country, created_at: now, updated_at: now });
    const contactId = await ctx.db.insert("contacts", { workspace_id: connection.workspace_id, company_id: companyId.toString(), full_name: fullName, email, phone, job_title: jobTitle, is_decision_maker: false, linkedin_url: pick(fields, ["linkedin", "linkedin_url"]) || undefined, created_at: now });
    const leadId = await ctx.db.insert("leads", { workspace_id: connection.workspace_id, company_id: companyId.toString(), contact_id: contactId.toString(), idempotency_key: pageScopedIdempotencyKey, contact_name: fullName, company_name: companyName, email, phone, source: "meta_leadgen", industry, monthly_budget: 0, estimated_value: 0, stage: "new", status: "qualified_pending_review", last_activity: now, notes: website ? "Website: " + website : undefined, assigned_agent: "za-meta-intake", automation_status: "evidence_verified_human_review_required", likes_count: 0, liked_by_me: false, created_at: now, updated_at: now });
    await ctx.db.insert("audit_logs", { workspace_id: connection.workspace_id, action: "meta_lead_promoted", entity_type: "lead", entity_id: leadId.toString(), actor: "meta-webhook", details: { leadgen_id: args.leadgen_id, evidence_id: evidenceId.toString(), outreach_eligible: false, reason: "retrieved_and_required_fields_present" }, created_at: now });
    return { ok: true, duplicate: false, evidence_id: evidenceId.toString(), promoted: true, lead_id: leadId.toString() };
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
  if (!pageAccessToken) return new Response("META_PAGE_ACCESS_TOKEN not configured", { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!signature.startsWith("sha256=")) return new Response("Invalid signature", { status: 401 });
  const expected = await hmacSha256Hex(rawBody, appSecret);
  if (!safeEqual(expected, signature.slice(7).toLowerCase())) return new Response("Invalid signature", { status: 401 });
  let body: any;
  try { body = JSON.parse(rawBody); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (body.object !== "page") return Response.json({ accepted: true, ignored: true });
  const results: Array<Record<string, unknown>> = [];
  let hasTemporaryFailure = false;
  let hasPermanentFailure = false;
  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== "leadgen") continue;
      const value = change.value ?? {};
      const pageId = String(value.page_id ?? entry.id ?? "");
      const leadgenId = String(value.leadgen_id ?? "");
      const formId = String(value.form_id ?? "");
      if (!pageId || !leadgenId) {
        results.push({ ok: false, leadgen_id: leadgenId, reason: "MISSING_REQUIRED_FIELDS", retryable: false });
        hasPermanentFailure = true;
        continue;
      }
      if (BLOCKED_PAGE_IDS.has(pageId)) {
        results.push({ ok: false, leadgen_id: leadgenId, reason: "BLOCKED_PAGE_ID", retryable: false });
        hasPermanentFailure = true;
        continue;
      }
      const eventKey = pageId + ":" + leadgenId;
      try {
        // Persist the signed event before the external Graph API call. This keeps failed retrievals replayable.
        const receipt = await ctx.runMutation(internal.meta.recordWebhookReceipt, {
          page_id: pageId, leadgen_id: leadgenId, form_id: formId, created_time: String(value.created_time ?? ""), raw_payload: value,
        });
        if (!receipt.ok || receipt.duplicate) {
          results.push({ ...receipt, leadgen_id: leadgenId });
          if (!receipt.ok) {
            if (receipt.reason === "EVENT_PROCESSING") hasTemporaryFailure = true;
            else hasPermanentFailure = true;
          }
          continue;
        }
        const retrievedLead = await retrieveLead(leadgenId, pageAccessToken);
        const mutationResult = await ctx.runMutation(internal.meta.recordWebhook, {
          page_id: pageId, leadgen_id: leadgenId, form_id: formId,
          created_time: String(value.created_time ?? retrievedLead?.created_time ?? ""), raw_payload: value, retrieved_lead: retrievedLead,
        });
        await ctx.runMutation(internal.meta.markWebhookStatus, {
          event_key: eventKey, status: mutationResult?.ok === false ? "permanent_failed" : "processed",
          last_error: mutationResult?.ok === false ? String(mutationResult.reason ?? "WEBHOOK_PROCESSING_FAILED") : undefined,
        });
        results.push({ ...mutationResult, leadgen_id: leadgenId });
        if (!mutationResult.ok) hasPermanentFailure = true;
      } catch (error) {
        const rawReason = error instanceof Error ? error.message : "";
        const metaStatus = /^META_LEAD_RETRIEVAL_FAILED:([0-9]{3}):/.exec(rawReason)?.[1];
        const reason = metaStatus ? "META_LEAD_RETRIEVAL_FAILED:" + metaStatus + ":upstream_error" : "TEMPORARY_WEBHOOK_PROCESSING_FAILURE";
        const retryable = isRetryableMetaWebhookError(error);
        try {
          await ctx.runMutation(internal.meta.markWebhookStatus, {
            event_key: eventKey, status: retryable ? "retryable_failed" : "permanent_failed", last_error: reason.slice(0, 500),
          });
        } catch {}
        results.push({ ok: false, leadgen_id: leadgenId, reason, retryable });
        if (retryable) hasTemporaryFailure = true; else hasPermanentFailure = true;
      }
    }
  }
  if (hasTemporaryFailure) return Response.json({ accepted: false, processed: results.length, results }, { status: 503 });
  if (hasPermanentFailure) return Response.json({ accepted: false, processed: results.length, results }, { status: 422 });
  return Response.json({ accepted: true, processed: results.length, results }, { status: 200 });
});
