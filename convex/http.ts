import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { webhook as metaWebhook } from "./meta";
import { submit as publicLeadSubmit } from "./publicLead";
import { httpAction } from "./_generated/server";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

const health = httpAction(async (_ctx, request) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  return Response.json(
    {
      status: "ok",
      service: "za-media-ai-growth-engine",
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
});

http.route({
  path: "/health",
  method: "GET",
  handler: health,
});

http.route({
  path: "/public-lead",
  method: "POST",
  handler: publicLeadSubmit,
});

http.route({
  path: "/meta-webhook",
  method: "GET",
  handler: metaWebhook,
});

http.route({
  path: "/meta-webhook",
  method: "POST",
  handler: metaWebhook,
});

export default http;
