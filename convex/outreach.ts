import { v } from "convex/values";
import { action, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Outbound production is intentionally frozen in the canonical code path.\n// Re-enabling requires an explicit code review/change; environment drift alone\n// must never be able to open the outbound gate.\nconst PRODUCTION_OUTBOUND_FROZEN = true;\nfunction productionFrozen() { return PRODUCTION_OUTBOUND_FROZEN; }

export const approve = mutation({
  args: { outreach_event_id: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    if (productionFrozen()) throw new Error("PRODUCTION_FREEZE: outbound approval is disabled.");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const workspace = await ctx.db.query("workspaces").withIndex("by_owner", (q: any) => q.eq("ownerSubject", identity.subject)).unique();
    if (!workspace) throw new Error("Workspace missing");
    const id = args.outreach_event_id as any;
    const event = await ctx.db.get(id);
    if (!event || (event as any).workspace_id !== workspace._id.toString()) throw new Error("Outreach event not found");
    if (!["drafted","reviewed"].includes((event as any).event_type)) throw new Error("Only drafted/reviewed outreach can be approved");
    await ctx.db.patch(id, { event_type: "approved", metadata: { ...((event as any).metadata ?? {}), approval_reason: args.reason, approved_at: new Date().toISOString() } });
    return { ok: true, id: args.outreach_event_id };
  },
});

export const getForSend = internalQuery({
  args: { outreach_event_id: v.string(), subject: v.string() },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.query("workspaces").withIndex("by_owner", (q: any) => q.eq("ownerSubject", args.subject)).unique();
    if (!workspace) return null;
    const event = await ctx.db.get(args.outreach_event_id as any);
    if (!event || (event as any).workspace_id !== workspace._id.toString()) return null;
    return event;
  },
});

export const send = action({
  args: { outreach_event_id: v.string() },
  handler: async (ctx, args) => {
    if (productionFrozen()) return { ok: false, reason: "PRODUCTION_FREEZE", evidence: "Outbound dispatch is globally disabled in canonical production." };
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, reason: "NOT_AUTHENTICATED" };
    const event = await ctx.runQuery(internal.outreach.getForSend, { outreach_event_id: args.outreach_event_id, subject: identity.subject });
    if (!event) return { ok: false, reason: "OUTREACH_EVENT_NOT_FOUND" };
    if ((event as any).event_type !== "approved") return { ok: false, reason: "APPROVAL_REQUIRED", evidence: "Outbound dispatch is fail-closed until event_type=approved." };
    return { ok: false, reason: "BLOCKED_OUTREACH_CREDENTIALS_NOT_CONFIGURED", evidence: "No verified production sending credential is configured in canonical Convex." };
  },
});
