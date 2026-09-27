import { v } from "convex/values";
import { action, mutation } from "./_generated/server";

export const saveAudit = mutation({
  args: { company_id: v.optional(v.string()), lead_id: v.optional(v.string()), audit_type: v.string(), result: v.any(), source_data: v.any() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const workspace = await ctx.db.query("workspaces").withIndex("by_owner", (q: any) => q.eq("ownerSubject", identity.subject)).unique();
    if (!workspace) throw new Error("Workspace missing");
    const result = args.result ?? {};
    const id = await ctx.db.insert("ai_audits", {
      workspace_id: workspace._id.toString(),
      company_id: args.company_id,
      lead_id: args.lead_id,
      audit_type: args.audit_type,
      overall_score: typeof result.overall_score === "number" ? result.overall_score : undefined,
      strengths: Array.isArray(result.strengths) ? result.strengths.map(String) : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses.map(String) : [],
      opportunities: Array.isArray(result.opportunities) ? result.opportunities.map(String) : [],
      recommended_actions: Array.isArray(result.recommended_actions) ? result.recommended_actions.map(String) : [],
      priority: typeof result.priority === "string" ? result.priority : undefined,
      source_data: args.source_data,
      created_at: new Date().toISOString(),
    });
    return id.toString();
  },
});

async function callGemini(prompt: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured in Convex production");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text);
}

export const growthAudit = action({
  args: { input: v.any() },
  handler: async (_ctx, args) => callGemini("Return strict JSON for a marketing growth audit with fields overall_score, strengths, weaknesses, opportunities, recommended_actions, priority. Input: " + JSON.stringify(args.input)),
});

export const qualifyLead = action({
  args: { lead: v.any() },
  handler: async (_ctx, args) => callGemini("Return strict JSON for lead qualification with fields score, qualification, reasoning, recommended_action, confidence. Input: " + JSON.stringify(args.lead)),
});
