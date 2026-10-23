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
    const ws = await requireWorkspace(ctx);
    const now = new Date().toISOString();
    const input = args.data as Record<string, any>;
    const data: Record<string, any> = {
      ...input,
      workspace_id: ws!._id.toString(),
      created_at: input.created_at ?? now,
    };

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
      case "audit_logs":
        data.actor ??= "dashboard";
        data.details ??= {};
        break;
      case "messages":
        data.ai_generated ??= false;
        break;
    }

    const id = await ctx.db.insert(args.table, data as any);
    return { ...data, id: id.toString(), _id: id.toString() };
  },
});
export const update = mutation({
  args: { table: tableValidator, id: v.string(), data: v.any() },
  handler: async (ctx, args) => {
    const ws = await requireWorkspace(ctx);
    const id = args.id as any;
    const existing = await ctx.db.get(id);
    if (!existing || (existing as any).workspace_id !== ws!._id.toString()) throw new Error("Record not found");
    const patch = { ...(args.data as Record<string, any>) };
    // Workspace ownership is assigned by the server and must never be client-editable.
    delete patch.workspace_id;
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
    const ws = await requireWorkspace(ctx);
    const id = args.id as any;
    const existing = await ctx.db.get(id);
    if (!existing || (existing as any).workspace_id !== ws!._id.toString()) throw new Error("Record not found");
    await ctx.db.delete(id);
    return true;
  },
});
