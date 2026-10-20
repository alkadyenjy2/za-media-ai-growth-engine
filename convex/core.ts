import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
const tables = ["companies","contacts","leads","campaigns","conversations","messages","audit_logs","income_records","ai_audits","prospect_outreach_events","meta_connections"] as const;
const tableValidator = v.union(...tables.map((name) => v.literal(name)));
async function getWorkspace(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return await ctx.db.query("workspaces").withIndex("by_owner", (q: any) => q.eq("ownerSubject", identity.subject)).unique();
}
async function requireWorkspace(ctx: any) {
  const existing = await getWorkspace(ctx);
  if (existing) return existing;
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const now = new Date().toISOString();
  const id = await ctx.db.insert("workspaces", { name: "ZA Media", ownerSubject: identity.subject, created_at: now });
  return await ctx.db.get(id);
}
export const workspace = query({ args: {}, handler: async (ctx) => getWorkspace(ctx) });
export const ensureWorkspace = mutation({ args: {}, handler: async (ctx) => {
  const ws = await requireWorkspace(ctx);
  return ws ? { ...ws, id: ws._id.toString() } : null;
}});
export const list = query({
  args: { table: tableValidator, limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const ws = await getWorkspace(ctx);
    if (!ws) return [];
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const rows = await ctx.db.query(args.table).collect();
    return rows.filter((row: any) => row.workspace_id === ws._id.toString()).slice(0, limit);
  },
});
export const insert = mutation({
  args: { table: tableValidator, data: v.any() },
  handler: async (ctx, args) => {
    if (args.table === "audit_logs") throw new Error("Audit logs are append-only; use recordAudit");
    const ws = await requireWorkspace(ctx);
    const now = new Date().toISOString();
    const input = args.data as Record<string, any>;
    const data: Record<string, any> = {
      ...input,
      workspace_id: ws!._id.toString(),
      created_at: input.created_at ?? now,
    };
    if (args.table === "meta_connections") {
      // Browser clients may request a connection, but only server verification may mark it verified.
      data.status = "pending";
      delete data.verified_at;
      data.provider ??= "meta";
      data.metadata ??= {};
      data.updated_at ??= now;
    }

    // The legacy-compatible client intentionally keeps forms small. Supply
    // schema-required operational defaults here so every CRUD surface writes
    // valid Convex documents rather than failing at runtime.
    switch (args.table) {
      case "companies":
        data.country ??= "unspecified";
        data.updated_at ??= now;
        break;
      case "leads":
        data.last_activity ??= now;
        data.assigned_agent ??= "za-dashboard";
        data.automation_status ??= "received_human_review_required";
        data.likes_count ??= 0;
        data.liked_by_me ??= false;
        data.updated_at ??= now;
        break;
      case "campaigns":
        data.leads_count ??= 0;
        data.spend ??= 0;
        break;
      case "conversations":
        data.last_message_at ??= now;
        break;
      case "income_records":
        data.transaction_date ??= now;
        break;
      case "messages":
        data.ai_generated ??= false;
        break;
    }

    const id = await ctx.db.insert(args.table, data as any);
    return { ...data, id: id.toString(), _id: id.toString() };
  },
});
export const recordAudit = mutation({
  args: { action: v.string(), entity_type: v.string(), entity_id: v.optional(v.string()), details: v.any() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    if (!args.action.trim() || args.action.length > 120) throw new Error("Invalid audit action");
    if (!args.entity_type.trim() || args.entity_type.length > 120) throw new Error("Invalid audit entity type");
    const details = args.details ?? {};
    if (JSON.stringify(details).length > 10000) throw new Error("Audit details exceed the 10000 character limit");
    const ws = await requireWorkspace(ctx);
    const now = new Date().toISOString();
    const id = await ctx.db.insert("audit_logs", {
      workspace_id: ws!._id.toString(),
      action: args.action,
      entity_type: args.entity_type,
      entity_id: args.entity_id,
      actor: identity.subject,
      details,
      created_at: now,
    });
    return { id: id.toString(), _id: id.toString(), workspace_id: ws!._id.toString(), action: args.action, entity_type: args.entity_type, entity_id: args.entity_id, actor: identity.subject, details, created_at: now };
  },
});
export const update = mutation({
  args: { table: tableValidator, id: v.string(), data: v.any() },
  handler: async (ctx, args) => {
    if (args.table === "audit_logs") throw new Error("Audit logs are append-only; use recordAudit");
    const ws = await requireWorkspace(ctx);
    const id = ctx.db.normalizeId(args.table, args.id);
    if (!id) throw new Error("Record not found");
    const existing = await ctx.db.get(id);
    if (!existing || (existing as any).workspace_id !== ws!._id.toString()) throw new Error("Record not found");
    const patch = { ...(args.data as Record<string, any>) };
    if (Object.prototype.hasOwnProperty.call(patch, "workspace_id")) {
      if (patch.workspace_id !== ws!._id.toString()) throw new Error("workspace_id cannot change");
      delete patch.workspace_id;
    }
    if (args.table === "meta_connections") {
      if (Object.prototype.hasOwnProperty.call(patch, "verified_at") || Object.prototype.hasOwnProperty.call(patch, "status")) throw new Error("Meta connection status is server-controlled");
      if (Object.prototype.hasOwnProperty.call(patch, "page_id")) throw new Error("Meta connection page_id is immutable");
    }
    // Only tables declaring updated_at in the Convex schema may receive it.
    if (args.table === "companies" || args.table === "leads" || args.table === "meta_connections") {
      patch.updated_at = new Date().toISOString();
    } else {
      delete patch.updated_at;
    }
    await ctx.db.patch(id, patch as any);
    const next = await ctx.db.get(id);
    return next ? { ...(next as any), id: id.toString(), _id: id.toString() } : null;
  },
});
export const remove = mutation({
  args: { table: tableValidator, id: v.string() },
  handler: async (ctx, args) => {
    if (args.table === "audit_logs") throw new Error("Audit logs are append-only; use recordAudit");
    const ws = await requireWorkspace(ctx);
    const id = ctx.db.normalizeId(args.table, args.id);
    if (!id) throw new Error("Record not found");
    const existing = await ctx.db.get(id);
    if (!existing || (existing as any).workspace_id !== ws!._id.toString()) throw new Error("Record not found");
    await ctx.db.delete(id);
    return true;
  },
});
