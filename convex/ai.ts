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
      workspace_id: workspace._id.toString(), company_id: args.company_id, lead_id: args.lead_id, audit_type: args.audit_type,
      overall_score: typeof result.overall_score === "number" ? result.overall_score : undefined,
      strengths: Array.isArray(result.strengths) ? result.strengths.map(String) : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses.map(String) : [],
      opportunities: Array.isArray(result.opportunities) ? result.opportunities.map(String) : [],
      recommended_actions: Array.isArray(result.recommended_actions) ? result.recommended_actions.map(String) : [],
      priority: typeof result.priority === "string" ? result.priority : undefined,
      source_data: args.source_data, created_at: new Date().toISOString(),
    });
    return id.toString();
  },
});

function textOf(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function ruleBasedQualification(lead: any) {
  const blob = JSON.stringify(lead ?? {}).toLowerCase();
  let score = 0;
  if (textOf(lead?.company ?? lead?.company_name)) score += 25;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(textOf(lead?.email))) score += 20;
  if (textOf(lead?.website ?? lead?.company_website)) score += 15;
  if (textOf(lead?.phone)) score += 5;
  if (/(usa|united states|saudi|uae|qatar|bahrain|dubai|riyadh|jeddah|doha|manama)/.test(blob)) score += 15;
  if (/(social media|marketing|instagram|facebook|content|lead generation|growth|agency)/.test(blob)) score += 10;
  if (/(roofing|egypt)/.test(blob)) score -= 30;
  score = Math.max(0, Math.min(100, score));
  const qualification = score >= 70 ? "high" : score >= 45 ? "medium" : "low";
  return { score, qualification, reasoning: "Deterministic evidence-based qualification fallback; no external model credential was available.", recommended_action: qualification === "high" ? "Review evidence and prepare a tailored outreach draft; do not send automatically." : qualification === "medium" ? "Collect missing business evidence before drafting outreach." : "Do not outreach; enrich or reject the lead.", confidence: 0.55, method: "rule_based_fallback" };
}

function ruleBasedGrowthAudit(input: any) {
  const blob = JSON.stringify(input ?? {}).toLowerCase();
  const strengths: string[] = []; const weaknesses: string[] = []; const opportunities: string[] = [];
  if (/facebook|instagram|social/.test(blob)) strengths.push("Social presence or social-media context is available in the supplied evidence.");
  if (/website|url/.test(blob)) strengths.push("A web presence is referenced in the supplied evidence.");
  if (!/website|url/.test(blob)) weaknesses.push("No website evidence was supplied.");
  if (!/email/.test(blob)) weaknesses.push("No email evidence was supplied.");
  if (/marketing|content|lead|growth/.test(blob)) opportunities.push("Use the stated growth/marketing context to build a tailored service hypothesis.");
  if (strengths.length === 0) weaknesses.push("Insufficient source evidence for a stronger audit.");
  opportunities.push("Collect verifiable public evidence before any outreach decision.");
  const overall_score = Math.max(0, Math.min(100, 50 + strengths.length * 12 + opportunities.length * 5 - weaknesses.length * 10));
  return { overall_score, strengths, weaknesses, opportunities, recommended_actions: ["Verify the source evidence", "Draft but do not send outreach until human approval"], priority: overall_score >= 70 ? "high" : overall_score >= 45 ? "medium" : "low", method: "rule_based_fallback" };
}

async function callGemini(prompt: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) });
  if (!response.ok) return null;
  const data = await response.json(); const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export const growthAudit = action({
  args: { input: v.any() },
  handler: async (_ctx, args) => (await callGemini("Return strict JSON for a marketing growth audit with fields overall_score, strengths, weaknesses, opportunities, recommended_actions, priority. Input: " + JSON.stringify(args.input))) ?? ruleBasedGrowthAudit(args.input),
});

export const qualifyLead = action({
  args: { lead: v.any() },
  handler: async (_ctx, args) => (await callGemini("Return strict JSON for lead qualification with fields score, qualification, reasoning, recommended_action, confidence. Input: " + JSON.stringify(args.lead))) ?? ruleBasedQualification(args.lead),
});
