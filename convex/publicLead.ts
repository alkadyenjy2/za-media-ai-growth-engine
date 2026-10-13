import { v } from "convex/values";
import { httpAction, internalMutation } from "./_generated/server";
import { anyApi } from "convex/server";

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const emailOk = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
const ALLOWED_PUBLIC_LEAD_ORIGINS = new Set([
  "https://za-media-ai-growth-engine.pages.dev",
]);

function leadCorsHeaders(origin: string) {
  const headers = new Headers({ Vary: "Origin" });
  if (ALLOWED_PUBLIC_LEAD_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

function leadJsonResponse(body: unknown, status: number, origin: string) {
  return Response.json(body, { status, headers: leadCorsHeaders(origin) });
}

export const record = internalMutation({
  args: {
    full_name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fullName = clean(args.full_name, 120);
    const email = clean(args.email, 254).toLowerCase();
    const phone = clean(args.phone, 80) || "not provided";
    const companyName = clean(args.company, 160) || fullName + " — website inquiry";
    if (!fullName || !emailOk(email)) throw new Error("Invalid lead details");

    const workspaces = await ctx.db.query("workspaces").collect();
    const workspace = workspaces.find((row: any) => row.name === "ZA Media");
    if (!workspace) throw new Error("ZA Media workspace is not initialized");

    const now = new Date().toISOString();
    const idempotencyKey = "website:" + email + ":" + now.slice(0, 10);
    const existingLead = await ctx.db
      .query("leads")
      .withIndex("by_idempotency", (q) => q.eq("idempotency_key", idempotencyKey))
      .first();
    if (existingLead) {
      return { ok: true, duplicate: true, lead_id: existingLead._id.toString() };
    }

    const companyId = await ctx.db.insert("companies", {
      workspace_id: workspace._id.toString(),
      name: companyName,
      industry: "Marketing inquiry",
      country: "unspecified",
      created_at: now,
      updated_at: now,
    });
    const contactId = await ctx.db.insert("contacts", {
      workspace_id: workspace._id.toString(),
      company_id: companyId.toString(),
      full_name: fullName,
      email,
      phone,
      job_title: "Inbound inquiry",
      is_decision_maker: false,
      created_at: now,
    });
    const leadId = await ctx.db.insert("leads", {
      workspace_id: workspace._id.toString(),
      company_id: companyId.toString(),
      contact_id: contactId.toString(),
      idempotency_key: idempotencyKey,
      contact_name: fullName,
      company_name: companyName,
      email,
      phone,
      source: "Website",
      industry: "Marketing Strategy & Planning",
      monthly_budget: 0,
      estimated_value: 0,
      stage: "intake",
      status: "new",
      last_activity: now,
      assigned_agent: "za-website-intake",
      automation_status: "received_human_review_required",
      likes_count: 0,
      liked_by_me: false,
      created_at: now,
      updated_at: now,
    });
    await ctx.db.insert("audit_logs", {
      workspace_id: workspace._id.toString(),
      action: "website_lead_received",
      entity_type: "lead",
      entity_id: leadId.toString(),
      actor: "public-website",
      details: { source: "landing_page", email, requested_service: "Marketing Strategy & Planning" },
      created_at: now,
    });
    return { ok: true, duplicate: false, lead_id: leadId.toString() };
  },
});

export const submit = httpAction(async (ctx, request) => {
  const origin = request.headers.get("origin") ?? "";
  const originAllowed = ALLOWED_PUBLIC_LEAD_ORIGINS.has(origin);

  if (request.method === "OPTIONS") {
    if (!originAllowed) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: leadCorsHeaders(origin) });
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (origin && !originAllowed) return new Response("Forbidden", { status: 403 });

  const cors = leadCorsHeaders(origin);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return leadJsonResponse({ ok: false, error: "Invalid JSON" }, 400, origin);
  }
  if (clean(body?.website, 200)) return leadJsonResponse({ ok: true }, 200, origin);

  try {
    const result = await ctx.runMutation(anyApi.publicLead.record, {
      full_name: clean(body?.full_name, 120),
      email: clean(body?.email, 254),
      phone: clean(body?.phone, 80) || undefined,
      company: clean(body?.company, 160) || undefined,
    });
    return leadJsonResponse(result, result.duplicate ? 200 : 201, origin);
  } catch (error) {
    return leadJsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Lead intake failed" },
      400,
      origin,
    );
  }
});
