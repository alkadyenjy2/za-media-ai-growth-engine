import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
export const approve = mutation({
  args: { outreach_event_id: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
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
export const send = action({
  args: { outreach_event_id: v.string() },
  handler: async (_ctx, _args) => ({ ok: false, reason: "BLOCKED_OUTREACH_CREDENTIALS_NOT_CONFIGURED", evidence: "No verified production sending credential is configured in canonical Convex." }),
});
