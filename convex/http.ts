import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
const http = httpRouter();
authComponent.registerRoutes(http, createAuth, { cors: true });
http.route({
  path: "/meta-webhook",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const verifyToken = process.env.META_VERIFY_TOKEN;
    if (!verifyToken) return new Response("META_VERIFY_TOKEN not configured", { status: 500 });
    if (url.searchParams.get("hub.mode") !== "subscribe" || url.searchParams.get("hub.verify_token") !== verifyToken) {
      return new Response("Forbidden", { status: 403 });
    }
    const challenge = url.searchParams.get("hub.challenge");
    return challenge ? new Response(challenge, { status: 200 }) : new Response("Missing challenge", { status: 400 });
  }),
});
http.route({
  path: "/meta-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) return new Response("META_APP_SECRET not configured", { status: 500 });
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    if (!signature.startsWith("sha256=")) return new Response("Invalid signature", { status: 401 });
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const expected = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const received = signature.slice(7).toLowerCase();
    if (expected.length !== received.length || !expected.split("").every((c, i) => c === received[i])) return new Response("Invalid signature", { status: 401 });
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
        if (!pageId || !leadgenId) continue;
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
  }),
});
export default http;
