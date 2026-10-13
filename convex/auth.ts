import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

// Keep the deployed frontend origin explicitly trusted. A stale SITE_URL
// environment value must not silently block browser signup via CORS.
const productionSiteUrl = "https://za-media-ai-growth-engine.pages.dev";
const siteUrl = process.env.SITE_URL;
const convexSiteUrl =
  process.env.CONVEX_SITE_URL ??
  "https://qualified-nightingale-421.eu-west-1.convex.site";
const trustedOrigins =
  siteUrl && siteUrl !== productionSiteUrl
    ? [productionSiteUrl, siteUrl]
    : [productionSiteUrl];

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: convexSiteUrl,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    plugins: [crossDomain({ siteUrl: productionSiteUrl }), convex({ authConfig })],
  });

export const getCurrentUser = async (ctx: GenericCtx<DataModel>) =>
  authComponent.getAuthUser(ctx);
