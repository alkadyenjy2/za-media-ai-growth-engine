import { v } from "convex/values";
import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const BLOCKED_PAGE_IDS = new Set(["179969831856298"]);
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v24.0";

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

export const recordWebhook = internalMutation({
  args: { page_id: v.string(), leadgen_id: v.string(), form_id: v.string(), created_time: v.string(), raw_payload: v.any(), retrieved_lead: v.optional(v.any()) },
  handler: async (ctx, args) => {
    const connection = await ctx.db.query("meta_connections").withIndex("by_page", (q: any) => q.eq("page_id", args.page_id)).unique();
    if (!connection || connection.status !== "verified") {
      await ctx.db.insert("audit_logs", { workspace_id: connection?.workspace_id ?? "unmapped", action: "meta_webhook_rejected", entity_type: "meta_webhook", actor: "meta-webhook", details: { reason: "no_verified_za_media_connection", page_id: args.page_id, leadgen_id: args.leadgen_id, form_id: args.form_id }, created_at: new Date().toISOString() });
      return { ok: false, reason: "NO_VERIFIED_META_CONNECTION" };
    }
    if (BLOCKED_PAGE_IDS.has(args.page_id)) return { ok: false, reason: "BLOCKED_PAGE_ID" };
    const auditRows = await ctx.db.query("audit_logs").withIndex("by_workspace", (q: any) => q.eq("workspace_id", connection.workspace_id)).collect();
    const existing = auditRows.find((row: any) => row.action === "meta_webhook_received" && row.details?.leadgen_id === args.leadgen_id);
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
    const now = new Date().toISOString();

    const evidenceId = await ctx.db.insert("audit_logs", { workspace_id: connection.workspace_id, action: "meta_webhook_received", entity_type: "meta_lead_evidence", actor: "meta-webhook", details: { leadgen_id: args.leadgen_id, page_id: args.page_id, form_id: args.form_id, created_time: args.created_time, raw_payload: args.raw_payload, retrieved_lead: lead, evidence_status: "received_signature_verified_and_retrieved", outreach_eligible: false }, created_at: now });

    if (!email || !phone || !fullName || !companyName) {
      await ctx.db.insert("audit_logs", { workspace_id: connection.workspace_id, action: "meta_lead_not_promoted", entity_type: "meta_lead_evidence", entity_id: evidenceId.toString(), actor: "meta-webhook", details: { reason: "required_fields_missing", leadgen_id: args.leadgen_id, required: ["full_name", "company_name", "email", "phone"], present: { full_name: !!fullName, company_name: !!companyName, email: !!email, phone: !!phone } }, created_at: now });
      return { ok: true, duplicate: false, evidence_id: evidenceId.toString(), promoted: false, reason: "REQUIRED_FIELDS_MISSING" };
    }

    const companyId = await ctx.db.insert("companies", { workspace_id: connection.workspace_id, name: companyName, domain: website || undefined, industry, country, created_at: now, updated_at: now });
    const contactId = await ctx.db.insert("contacts", { workspace_id: connection.workspace_id, company_id: companyId.toString(), full_name: fullName, email, phone, job_title: pick(fields, ["job_title", "title", "role"]) || "decision maker", is_decision_maker: true, linkedin_url: pick(fields, ["linkedin", "linkedin_url"]) || undefined, created_at: now });
    const leadId = await ctx.db.insert("leads", { workspace_id: connection.workspace_id, company_id: companyId.toString(), contact_id: contactId.toString(), idempotency_key: "meta:" + args.leadgen_id, contact_name: fullName, company_name: companyName, email, phone, source: "meta_leadgen", industry, monthly_budget: 0, estimated_value: 0, stage: "new", status: "qualified_pending_review", last_activity: now, notes: website ? "Website: " + website : undefined, assigned_agent: "za-meta-intake", automation_status: "evidence_verified_human_review_required", likes_count: 0, liked_by_me: false, created_at: now, updated_at: now });
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
  const results = [];
  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== "leadgen") continue;
      const value = change.value ?? {};
      const pageId = String(value.page_id ?? entry.id ?? "");
      const leadgenId = String(value.leadgen_id ?? "");
      const formId = String(value.form_id ?? "");
      if (!pageId || !leadgenId || BLOCKED_PAGE_IDS.has(pageId)) continue;
      try {
        const retrievedLead = await retrieveLead(leadgenId, pageAccessToken);
        results.push(await ctx.runMutation(internal.meta.recordWebhook, { page_id: pageId, leadgen_id: leadgenId, form_id: formId, created_time: String(value.created_time ?? retrievedLead?.created_time ?? ""), raw_payload: value, retrieved_lead: retrievedLead }));
      } catch (error) {
        results.push({ ok: false, leadgen_id: leadgenId, reason: error instanceof Error ? error.message : "META_LEAD_RETRIEVAL_FAILED" });
      }
    }
  }
  return Response.json({ accepted: true, processed: results.length, results });
});
