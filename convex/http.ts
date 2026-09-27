import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { webhook as metaWebhook } from "./meta";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

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
