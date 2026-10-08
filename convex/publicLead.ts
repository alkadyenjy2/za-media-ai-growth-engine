import { v } from "convex/values";
import { httpAction, internalMutation } from "./_generated/server";
import { anyApi } from "convex/server";

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const emailOk = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

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
    const workspace = workspaces.find((row: any) => row.name === "ZA Media") ?? workspaces[0];
    if (!workspace) throw new Error("ZA Media workspace is not initialized");

    const now = new Date().toISOString();
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
      idempotency_key: "website:" + email + ":" + now.slice(0, 10),
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
    return { ok: true, lead_id: leadId.toString() };
  },
});

export const submit = httpAction(async (ctx, request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const origin = request.headers.get("origin") ?? "";
  if (origin && !/https:\/\/(?:[^/]+\.)?vercel\.app$/i.test(origin) && !/^https:\/\/za-media/i.test(origin)) {
    return new Response("Forbidden", { status: 403 });
  }
  let body: any;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (clean(body?.website, 200)) return Response.json({ ok: true });
  try {
    const result = await ctx.runMutation(anyApi.publicLead.record, {
      full_name: clean(body?.full_name, 120),
      email: clean(body?.email, 254),
      phone: clean(body?.phone, 80) || undefined,
      company: clean(body?.company, 160) || undefined,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Lead intake failed" }, { status: 400 });
  }
});
