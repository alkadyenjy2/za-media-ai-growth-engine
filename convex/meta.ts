import { v } from "convex/values";
import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const BLOCKED_PAGE_IDS = new Set(["179969831856298"]);


async function hmacSha256Hex(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const recordWebhook = internalMutation({
  args: {
    page_id: v.string(),
    leadgen_id: v.string(),
    form_id: v.string(),
    created_time: v.string(),
    raw_payload: v.any(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("meta_connections")
      .withIndex("by_page", (q: any) => q.eq("page_id", args.page_id))
      .unique();
    if (!connection || connection.status !== "verified") {
      await ctx.db.insert("audit_logs", {
        workspace_id: connection?.workspace_id ?? "unmapped",
        action: "meta_webhook_rejected",
        entity_type: "meta_webhook",
        actor: "meta-webhook",
        details: { reason: "no_verified_za_media_connection", page_id: args.page_id, leadgen_id: args.leadgen_id, form_id: args.form_id },
        created_at: new Date().toISOString(),
      });
      return { ok: false, reason: "NO_VERIFIED_META_CONNECTION" };
    }
    if (BLOCKED_PAGE_IDS.has(args.page_id)) return { ok: false, reason: "BLOCKED_PAGE_ID" };

    const auditRows = await ctx.db
      .query("audit_logs")
      .withIndex("by_workspace", (q: any) => q.eq("workspace_id", connection.workspace_id))
      .collect();
    const existing = auditRows.find((row: any) =>
      row.action === "meta_webhook_received" && row.details?.leadgen_id === args.leadgen_id
    );
    if (existing) return { ok: true, duplicate: true, evidence_id: existing._id.toString() };

    const evidenceId = await ctx.db.insert("audit_logs", {
      workspace_id: connection.workspace_id,
      action: "meta_webhook_received",
      entity_type: "meta_lead_evidence",
      actor: "meta-webhook",
      details: {
        leadgen_id: args.leadgen_id,
        page_id: args.page_id,
        form_id: args.form_id,
        created_time: args.created_time,
        raw_payload: args.raw_payload,
        evidence_status: "received_and_signature_verified",
        outreach_eligible: false,
      },
      created_at: new Date().toISOString(),
    });
    return { ok: true, duplicate: false, evidence_id: evidenceId.toString() };
  },
});

export const webhook = httpAction(async (ctx, request) => {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const verifyToken = process.env.META_VERIFY_TOKEN;
    if (!verifyToken) return new Response("META_VERIFY_TOKEN not configured", { status: 500 });
    if (url.searchParams.get("hub.mode") !== "subscribe" || url.searchParams.get("hub.verify_token") !== verifyToken) {
      return new Response("Forbidden", { status: 403 });
    }
    const challenge = url.searchParams.get("hub.challenge");
    return challenge ? new Response(challenge, { status: 200 }) : new Response("Missing challenge", { status: 400 });
  }

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return new Response("META_APP_SECRET not configured", { status: 500 });

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
      results.push(await ctx.runMutation(internal.meta.recordWebhook, {
        page_id: pageId,
        leadgen_id: leadgenId,
        form_id: formId,
        created_time: String(value.created_time ?? ""),
        raw_payload: value,
      }));
    }
  }
  return Response.json({ accepted: true, processed: results.length, results });
});
