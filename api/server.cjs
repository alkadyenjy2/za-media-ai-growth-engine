var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  app: () => app,
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_supabase_js = require("@supabase/supabase-js");

// src/lib/webhookPolicy.ts
var DEFAULT_PRODUCTION_WEBHOOK_URL = "";
function configuredHosts(configuredUrl) {
  const hosts = [];
  if (configuredUrl) {
    try {
      hosts.push(new URL(configuredUrl).hostname.toLowerCase());
    } catch {
    }
  }
  if (typeof process !== "undefined" && process.env?.N8N_ALLOWED_HOSTS) {
    hosts.push(...process.env.N8N_ALLOWED_HOSTS.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));
  }
  return hosts;
}
function isAllowedWebhookUrl(targetUrl, configuredUrl = typeof process !== "undefined" ? process.env?.N8N_WEBHOOK_URL || process.env?.VITE_N8N_WEBHOOK_URL : void 0) {
  if (!targetUrl || typeof targetUrl !== "string") return false;
  try {
    const parsed = new URL(targetUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    const privateHost = host === "127.0.0.1" || host === "0.0.0.0" || host === "localhost" || host === "::1" || host.startsWith("169.254.") || host.startsWith("10.") || host.startsWith("172.16.") || host.startsWith("192.168.") || host.endsWith(".internal") || host.endsWith(".local");
    if (privateHost) return false;
    const hosts = configuredHosts(configuredUrl);
    return hosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
  } catch {
    return false;
  }
}
function resolveSafeWebhookUrl(requestedUrl, configuredUrl = typeof process !== "undefined" ? process.env?.N8N_WEBHOOK_URL || process.env?.VITE_N8N_WEBHOOK_URL : void 0) {
  if (requestedUrl && isAllowedWebhookUrl(requestedUrl, configuredUrl)) return requestedUrl.trim();
  if (configuredUrl && isAllowedWebhookUrl(configuredUrl, configuredUrl)) return configuredUrl.trim();
  return DEFAULT_PRODUCTION_WEBHOOK_URL;
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
app.use(import_express.default.json({
  limit: "256kb",
  verify: (req, _res, buffer) => {
    req.rawBody = buffer.toString("utf8");
  }
}));
var PORT = Number(process.env.PORT || 3e3);
function getSupabaseServerClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return (0, import_supabase_js.createClient)(url, key);
}
async function requireAuth(req, res, next) {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return res.status(401).json({ success: false, error: "Authentication required." });
  const supabaseServer = getSupabaseServerClient();
  if (!supabaseServer) return res.status(503).json({ success: false, error: "Authentication service is not configured." });
  const { data: { user }, error: userError } = await supabaseServer.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ success: false, error: "Invalid or expired session." });
  const { data: membership, error: membershipError } = await supabaseServer.from("organization_memberships").select("organization_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (membershipError || !membership?.organization_id) {
    return res.status(403).json({ success: false, error: "User has no organization membership." });
  }
  const authenticatedRequest = req;
  authenticatedRequest.userId = user.id;
  authenticatedRequest.organizationId = membership.organization_id;
  return next();
}
function verifyN8nCallbackSignature(req, res, next) {
  const secret = process.env.N8N_CALLBACK_SIGNING_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, error: "n8n callback signing is not configured." });
  }
  const timestamp = req.header("x-n8n-timestamp") || "";
  const signatureHeader = req.header("x-n8n-signature") || "";
  const signature = signatureHeader.replace(/^sha256=/i, "").trim();
  const timestampMs = Number(timestamp) * 1e3;
  const maxSkewMs = 5 * 60 * 1e3;
  if (!/^\d+$/.test(timestamp) || !Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > maxSkewMs) {
    return res.status(401).json({ success: false, error: "Invalid or expired callback timestamp." });
  }
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const expected = import_crypto.default.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (providedBuffer.length !== expectedBuffer.length || !import_crypto.default.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return res.status(401).json({ success: false, error: "Invalid callback signature." });
  }
  req.callbackSignatureVerified = true;
  return next();
}
app.use("/api", (req, res, next) => {
  if (req.path === "/health") return next();
  if (req.path === "/n8n-callback") return verifyN8nCallbackSignature(req, res, next);
  return requireAuth(req, res, next);
});
function getGenAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is not set. Server AI calls are unavailable.");
    return null;
  }
  return new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
app.post("/api/n8n-webhook", async (req, res) => {
  try {
    const { webhookUrl, payload, sync } = req.body;
    const targetUrl = resolveSafeWebhookUrl(webhookUrl);
    if (!isAllowedWebhookUrl(targetUrl)) {
      console.warn(`[n8n Webhook Security] Blocked unauthorized or invalid webhook URL: ${targetUrl}`);
      return res.status(400).json({
        success: false,
        status: 400,
        message: `Security error: The target webhook domain (${targetUrl}) is not authorized for proxy dispatch.`
      });
    }
    console.log(`[n8n Webhook Engine] Proxying dispatch to: ${targetUrl}`);
    if (sync === true) {
      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "ZA-Media-AI-Engine/1.0"
          },
          body: JSON.stringify(payload || {})
        });
        const responseText = await response.text();
        let responseData = null;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }
        if (response.ok) {
          return res.json({
            success: true,
            status: response.status,
            workflowActive: true,
            reachable: true,
            message: `Successfully executed n8n webhook workflow at ${targetUrl}`,
            data: responseData
          });
        } else if (response.status === 404) {
          const hint = typeof responseData === "object" && responseData !== null ? responseData.message || responseData.hint || JSON.stringify(responseData) : typeof responseData === "string" && responseData.length > 0 ? responseData : "Workflow is awaiting activation in n8n UI";
          return res.status(502).json({
            success: false,
            status: 404,
            workflowActive: false,
            reachable: true,
            message: `n8n server host connected! Workflow is currently awaiting activation in n8n: ${hint}`,
            data: responseData
          });
        } else {
          return res.json({
            success: false,
            status: response.status,
            reachable: true,
            message: `n8n Webhook responded with status ${response.status}`,
            data: responseData
          });
        }
      } catch (fetchErr) {
        const isDnsError = fetchErr?.cause?.code === "ENOTFOUND" || fetchErr?.message?.includes("ENOTFOUND");
        const errorDetail = isDnsError ? `DNS ENOTFOUND: Domain host in '${targetUrl}' could not be resolved. Check domain DNS settings or update VITE_N8N_WEBHOOK_URL.` : fetchErr?.message || "Network request failed";
        console.warn(`[n8n Webhook Engine] Synchronous dispatch network warning: ${errorDetail}`);
        return res.status(502).json({
          success: false,
          status: 502,
          errorCode: fetchErr?.cause?.code || "FETCH_ERROR",
          message: errorDetail,
          targetUrl
        });
      }
    }
    res.json({
      success: true,
      status: 200,
      message: `Webhook event accepted and queued for instant background execution to ${targetUrl}`,
      dispatchTime: (/* @__PURE__ */ new Date()).toISOString()
    });
    fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ZA-Media-AI-Engine/1.0"
      },
      body: JSON.stringify(payload || {})
    }).then(async (response) => {
      const responseText = await response.text().catch(() => "");
      console.log(`[n8n Webhook Engine] Background dispatch completed (${response.status}):`, responseText.slice(0, 200));
    }).catch((err) => {
      console.error("[n8n Webhook Engine] Background dispatch network error:", err.message);
    });
  } catch (error) {
    console.error("n8n webhook proxy error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to accept webhook"
    });
  }
});
var n8nExecutionHistory = [];
function recordN8nExecution(rec) {
  const newRec = {
    id: "test-exec-" + import_crypto.default.randomUUID(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...rec
  };
  n8nExecutionHistory.unshift(newRec);
  if (n8nExecutionHistory.length > 50) {
    n8nExecutionHistory.pop();
  }
  return newRec;
}
function getN8nApiConfig() {
  const baseUrl = process.env.N8N_API_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.N8N_API_KEY;
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
}
function n8nApiHeaders(apiKey) {
  return { Accept: "application/json", "X-N8N-API-KEY": apiKey };
}
app.get("/api/n8n/workflows", async (_req, res) => {
  const config = getN8nApiConfig();
  if (!config) return res.status(503).json({ success: false, code: "N8N_API_NOT_CONFIGURED", error: "n8n API credentials are not configured." });
  try {
    const response = await fetch(`${config.baseUrl}/workflows?limit=100`, { headers: n8nApiHeaders(config.apiKey) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ success: false, code: "N8N_API_ERROR", error: `n8n API returned HTTP ${response.status}.` });
    const workflows = Array.isArray(body.data) ? body.data : [];
    return res.json({ success: true, source: "n8n_api", workflows, stats: { totalWorkflows: workflows.length, lastHealthCheck: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (error) {
    console.error("n8n workflows API error:", error);
    return res.status(502).json({ success: false, code: "N8N_API_UNREACHABLE", error: "Unable to reach the configured n8n API." });
  }
});
app.get("/api/n8n/executions", async (req, res) => {
  const config = getN8nApiConfig();
  if (!config) return res.status(503).json({ success: false, code: "N8N_API_NOT_CONFIGURED", error: "n8n API credentials are not configured." });
  try {
    const requestedLimit = Number(req.query.limit) || 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const statusFilter = typeof req.query.status === "string" ? req.query.status : "";
    const response = await fetch(`${config.baseUrl}/executions?limit=${limit}`, { headers: n8nApiHeaders(config.apiKey) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ success: false, code: "N8N_API_ERROR", error: `n8n API returned HTTP ${response.status}.` });
    let executions = Array.isArray(body.data) ? body.data : [];
    if (statusFilter && statusFilter !== "all") executions = executions.filter((execution) => execution.status === statusFilter);
    return res.json({ success: true, source: "n8n_api", executions, totalCount: executions.length, errorCount: executions.filter((execution) => execution.status === "error").length });
  } catch (error) {
    console.error("n8n executions API error:", error);
    return res.status(502).json({ success: false, code: "N8N_API_UNREACHABLE", error: "Unable to reach the configured n8n API." });
  }
});
app.post("/api/n8n/test-trigger", async (req, res) => {
  try {
    const finalUrl = process.env.N8N_TEST_WEBHOOK_URL;
    if (!finalUrl) return res.status(503).json({ success: false, code: "N8N_TEST_WEBHOOK_NOT_CONFIGURED", error: "A dedicated n8n test webhook is not configured." });
    if (!isAllowedWebhookUrl(finalUrl)) return res.status(503).json({ success: false, code: "N8N_TEST_WEBHOOK_NOT_ALLOWED", error: "Configured n8n test webhook is not in the server allowlist." });
    const { workflowId, payload } = req.body || {};
    const targetWf = { id: workflowId || "configured-test-webhook", name: "Configured n8n test webhook" };
    const startTime = Date.now();
    let httpStatus = 200;
    let responseData = null;
    let isSuccess = true;
    let errMsg = "";
    try {
      const response = await fetch(finalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "ZA-Media-AI-Engine/1.0" },
        body: JSON.stringify(payload || { test: true, timestamp: (/* @__PURE__ */ new Date()).toISOString(), trigger: "N8nAutomationMonitor" })
      });
      httpStatus = response.status;
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }
      if (response.ok) {
        isSuccess = true;
      } else {
        isSuccess = false;
        errMsg = `HTTP ${response.status}: Server returned error.`;
      }
    } catch (err) {
      isSuccess = false;
      httpStatus = 502;
      errMsg = err.message || "Network fetch failed";
    }
    const duration = Date.now() - startTime;
    const recorded = recordN8nExecution({
      workflowId: targetWf.id,
      workflowName: targetWf.name,
      webhookUrl: finalUrl,
      status: isSuccess ? "success" : "error",
      httpStatus,
      durationMs: duration,
      triggerSource: "Manual Test (Automation Monitor)",
      leadName: payload?.contactName || payload?.name || "Synthetic test payload",
      leadEmail: payload?.email || "synthetic-test@invalid.local",
      payload: payload || {},
      response: responseData,
      errorMessage: errMsg || void 0,
      nodeTrace: [
        { nodeName: "Webhook Received", status: "completed", durationMs: 25 },
        { nodeName: "Payload Validation", status: "completed", durationMs: 35 },
        { nodeName: "Downstream Dispatch", status: isSuccess ? "completed" : "failed", durationMs: Math.max(duration - 60, 20) }
      ]
    });
    res.json({
      success: isSuccess,
      source: "configured_test_webhook",
      execution: { ...recorded, persisted: false }
    });
  } catch (error) {
    console.error("n8n test trigger error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to execute test trigger" });
  }
});
app.post("/api/n8n/autofix-error", async (req, res) => {
  try {
    const { errorMessage, nodeName, payload, httpStatus } = req.body;
    const ai = getGenAiClient();
    if (!ai) {
      return res.status(503).json({ success: false, code: "AI_NOT_CONFIGURED", error: "GEMINI_API_KEY is required for n8n error analysis." });
    }
    const prompt = `You are an elite n8n Automation & DevOps AI Specialist.
Analyze the following n8n workflow execution error and provide step-by-step remediation advice:
- Failed Node: ${nodeName || "Webhook / Downstream Node"}
- HTTP Status: ${httpStatus || 500}
- Error Detail: ${errorMessage || "Execution returned non-200 response"}
- Sample Input Payload: ${JSON.stringify(payload || {})}

Provide your response in JSON format with:
- rootCause: String (Clear, concise diagnostic explanation).
- fixSteps: Array of 3-4 actionable numbered strings explaining how to fix it in the n8n UI canvas.
- recommendedNodeConfig: String (Quick guidance on parameters, expressions, or authentication credentials).
- confidenceScore: Number (0-100).`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            rootCause: { type: import_genai.Type.STRING },
            fixSteps: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
            recommendedNodeConfig: { type: import_genai.Type.STRING },
            confidenceScore: { type: import_genai.Type.INTEGER }
          },
          required: ["rootCause", "fixSteps", "recommendedNodeConfig", "confidenceScore"]
        }
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    res.json({ success: true, remediation: parsed });
  } catch (error) {
    console.error("n8n autofix error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate AI autofix remediation" });
  }
});
app.post("/api/n8n-callback", async (req, res) => {
  try {
    const {
      leadId,
      lead_id,
      id,
      email,
      status,
      stage,
      notes,
      summary,
      lastActivity,
      activityTitle,
      workflowName,
      workflow_name,
      executionId,
      execution_id,
      companyName,
      contactName
    } = req.body || {};
    const targetLeadId = leadId || lead_id || id;
    const targetEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const organizationId = req.body?.organizationId || req.body?.organization_id;
    const wfName = workflowName || workflow_name || "n8n Workflow Execution";
    const execId = executionId || execution_id || "";
    const eventId = req.body?.eventId || req.body?.event_id || execId;
    if (!targetLeadId && !targetEmail) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Validation Error: Callback payload must include a lead identifier ('leadId', 'lead_id', 'id', or 'email')."
      });
    }
    if (!organizationId || !eventId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Validation Error: organization_id and event_id are required."
      });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(organizationId))) {
      return res.status(400).json({ success: false, status: 400, message: "Invalid organization_id." });
    }
    console.log(`[n8n Callback Engine] Callback received for lead '${targetLeadId || targetEmail}' from workflow '${wfName}' (Execution: ${execId})`);
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return res.status(503).json({ success: false, status: 503, message: "Supabase service-role configuration is required for callbacks." });
    }
    const activityDesc = notes || summary || lastActivity || `n8n workflow '${wfName}' completed successfully.`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    const payloadHash = import_crypto.default.createHash("sha256").update(rawBody).digest("hex");
    const { data: existingReceipt, error: receiptLookupError } = await supabase.from("n8n_callback_receipts").select("event_id, status, organization_id").eq("event_id", String(eventId)).maybeSingle();
    if (receiptLookupError) {
      return res.status(500).json({ success: false, status: 500, message: "Unable to verify callback idempotency." });
    }
    if (existingReceipt) {
      if (existingReceipt.organization_id !== organizationId) {
        return res.status(409).json({ success: false, status: 409, message: "Callback event is already associated with another organization." });
      }
      return res.json({ success: true, duplicate: true, status: 200, message: "Callback already processed or in progress.", data: existingReceipt });
    }
    const { error: receiptInsertError } = await supabase.from("n8n_callback_receipts").insert([{
      event_id: String(eventId),
      organization_id: organizationId,
      execution_id: execId || null,
      payload_hash: payloadHash,
      status: "processing",
      received_at: nowIso
    }]);
    if (receiptInsertError) {
      if (receiptInsertError.code === "23505") {
        return res.json({ success: true, duplicate: true, status: 200, message: "Callback already processed or in progress." });
      }
      return res.status(500).json({ success: false, status: 500, message: "Unable to register callback receipt." });
    }
    let leadQuery = supabase.from("leads").select("id, email, organization_id").eq("organization_id", organizationId);
    leadQuery = targetLeadId ? leadQuery.eq("id", targetLeadId) : leadQuery.eq("email", targetEmail);
    const { data: lead, error: leadLookupError } = await leadQuery.maybeSingle();
    if (leadLookupError || !lead) {
      await supabase.from("n8n_callback_receipts").update({ status: "failed" }).eq("event_id", String(eventId));
      return res.status(leadLookupError ? 500 : 404).json({ success: false, status: leadLookupError ? 500 : 404, message: leadLookupError ? "Unable to resolve callback Lead." : "Lead not found in callback organization." });
    }
    const updateData = { updated_at: nowIso, last_activity: activityDesc };
    if (status) updateData.status = status;
    if (stage) updateData.stage = stage;
    if (notes || summary) updateData.notes = notes || summary;
    const { error: leadUpdateError } = await supabase.from("leads").update(updateData).eq("id", lead.id).eq("organization_id", organizationId);
    if (leadUpdateError) {
      await supabase.from("n8n_callback_receipts").update({ status: "failed" }).eq("event_id", String(eventId));
      return res.status(500).json({ success: false, status: 500, message: "Lead update failed.", error: leadUpdateError.message });
    }
    const auditPayload = {
      organization_id: organizationId,
      title: activityTitle || `n8n Workflow Completed: ${wfName}`,
      description: activityDesc,
      type: "automation",
      lead_name: companyName || contactName || lead.email || lead.id,
      status: "success",
      created_at: nowIso
    };
    const { error: auditError } = await supabase.from("audit_logs").insert([auditPayload]);
    if (auditError) {
      await supabase.from("n8n_callback_receipts").update({ status: "failed" }).eq("event_id", String(eventId));
      return res.status(500).json({ success: false, status: 500, message: "Audit log write failed.", error: auditError.message });
    }
    const { error: receiptCompleteError } = await supabase.from("n8n_callback_receipts").update({ status: "processed", processed_at: nowIso }).eq("event_id", String(eventId));
    if (receiptCompleteError) {
      console.error("[n8n Callback Engine] Receipt completion update failed:", receiptCompleteError.message);
    }
    const updatedInSupabase = true;
    const databaseError = null;
    return res.json({
      success: true,
      status: 200,
      message: `n8n callback processed successfully for lead '${targetLeadId || targetEmail}'`,
      data: {
        leadId: lead.id,
        email: lead.email || targetEmail || null,
        organizationId,
        status: status || null,
        stage: stage || null,
        lastActivity: activityDesc,
        workflowName: wfName,
        executionId: execId,
        updatedInSupabase,
        databaseError
      }
    });
  } catch (error) {
    console.error("[n8n Callback Engine] Callback processing error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: error.message || "Failed to process n8n callback"
    });
  }
});
app.post("/api/score-lead", async (req, res) => {
  try {
    const { contactName, companyName, email, phone, industry, monthlyBudget, estimatedValue, source, notes } = req.body;
    const ai = getGenAiClient();
    if (!ai) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY environment variable is missing on server."
      });
    }
    const systemInstruction = `You are an executive AI Lead Qualification & Quality Assurance Agent for ZA Media AI Growth Engine.
Your job is to analyze lead submission data, score data completeness, commercial intent, ICP alignment, and budget fit, and output structured lead evaluation metrics.`;
    const prompt = `Evaluate the data quality and commercial viability of this newly submitted lead:
- Contact Name: ${contactName || "Unknown"}
- Company Name: ${companyName || "Unknown"}
- Email: ${email || "N/A"}
- Phone: ${phone || "N/A"}
- Industry: ${industry || "General Services"}
- Monthly Ad Budget: $${monthlyBudget || 0}
- Estimated Deal Value: $${estimatedValue || 0}
- Intake Channel: ${source || "Web Form"}
- Notes: ${notes || "None"}

Evaluate and output JSON with:
1. overallScore (0-100)
2. icpFitScore (0-100)
3. budgetMatchScore (0-100)
4. buyingIntentScore (0-100)
5. decisionMakerVerified (boolean)
6. keyInsights (array of 2-4 strings summarizing reasons)
7. recommendedAction (string)
8. status ("Hot" if overallScore >= 85, "Warm" if >= 65, else "Cold")`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            overallScore: { type: import_genai.Type.INTEGER },
            icpFitScore: { type: import_genai.Type.INTEGER },
            budgetMatchScore: { type: import_genai.Type.INTEGER },
            buyingIntentScore: { type: import_genai.Type.INTEGER },
            decisionMakerVerified: { type: import_genai.Type.BOOLEAN },
            keyInsights: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING }
            },
            recommendedAction: { type: import_genai.Type.STRING },
            status: { type: import_genai.Type.STRING }
          },
          required: [
            "overallScore",
            "icpFitScore",
            "budgetMatchScore",
            "buyingIntentScore",
            "decisionMakerVerified",
            "keyInsights",
            "recommendedAction",
            "status"
          ]
        }
      }
    });
    const contentText = response.text || "{}";
    const parsed = JSON.parse(contentText);
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Gemini lead scoring error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to evaluate lead quality" });
  }
});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", serverTime: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/sales-automation", async (req, res) => {
  try {
    const { contactName, companyName, email, phone, industry, monthlyBudget, source, notes } = req.body;
    const ai = getGenAiClient();
    if (!ai) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY environment variable is missing on server."
      });
    }
    const systemInstruction = `You are an executive AI Sales Automation Agent for ZA Media AI Growth Engine.
Your role is to automatically analyze inbound leads, calculate qualification priority, determine the optimal sales strategy, and generate personalized, high-converting Email and WhatsApp/Facebook DM outreach drafts and follow-up schedules.`;
    const prompt = `Analyze this newly ingested lead and generate a complete automated sales execution package:
- Contact Name: ${contactName || "Valued Prospect"}
- Company Name: ${companyName || "Target Enterprise"}
- Email: ${email || "prospect@company.com"}
- Phone: ${phone || "N/A"}
- Industry: ${industry || "Roofing / Services"}
- Monthly Budget: $${monthlyBudget || 5e3}
- Intake Channel: ${source || "Inbound Web Form"}
- Requirements/Notes: ${notes || "Interested in AI growth engine and automated lead qualification"}

Respond STRICTLY in JSON format with the following fields:
- qualificationScore: Number (0-100) based on budget, industry fit, and explicit buying intent.
- icpFitScore: Number (0-100) assessing ideal customer profile alignment.
- priority: String ("P1 - Critical Hot", "P2 - High Priority", "P3 - Moderate", or "P4 - Low / Nurture").
- bestResponseStrategy: Strategic 2-3 sentence overview of the recommended sales position, pitch angle, and value hook.
- emailSubject: High-open-rate subject line for a personalized outreach email.
- emailBody: Full personalized email body text addressing ${contactName} at ${companyName}, presenting a clear value proposal tailored to their budget ($${monthlyBudget}) and industry, ending with a low-friction booking call-to-action.
- socialDmText: Punchy, friendly WhatsApp / Facebook DM message (with emojis) formatted for instant messaging.
- followUpTask: Specific action task for the sales team (e.g. "Send calendar invite if no response in 24 hours").
- followUpDays: Number of days before follow-up (e.g. 1, 2, or 3).`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            qualificationScore: { type: import_genai.Type.INTEGER },
            icpFitScore: { type: import_genai.Type.INTEGER },
            priority: { type: import_genai.Type.STRING },
            bestResponseStrategy: { type: import_genai.Type.STRING },
            emailSubject: { type: import_genai.Type.STRING },
            emailBody: { type: import_genai.Type.STRING },
            socialDmText: { type: import_genai.Type.STRING },
            followUpTask: { type: import_genai.Type.STRING },
            followUpDays: { type: import_genai.Type.INTEGER }
          },
          required: [
            "qualificationScore",
            "icpFitScore",
            "priority",
            "bestResponseStrategy",
            "emailSubject",
            "emailBody",
            "socialDmText",
            "followUpTask",
            "followUpDays"
          ]
        }
      }
    });
    const contentText = response.text || "{}";
    const parsed = JSON.parse(contentText);
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Gemini sales automation error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to execute sales automation" });
  }
});
app.post("/api/generate-content", async (req, res) => {
  try {
    const { niche, goal, targetAudience, tone, customPrompt } = req.body;
    const ai = getGenAiClient();
    if (!ai) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY environment variable is missing on server."
      });
    }
    const systemInstruction = `You are an elite AI Marketing Copywriter specializing in high-converting Facebook posts and marketing campaigns for service businesses (e.g. Roofing Companies, Home Services, Solar, B2B Growth).
You generate highly engaging, targeted marketing campaigns with strong hooks, punchy posts, clear CTAs, image prompts for AI visual generation, and trending hashtags.`;
    const prompt = `Generate a complete Facebook Marketing Post Campaign for:
- Industry / Niche: ${niche || "Roofing & Construction Services"}
- Campaign Goal: ${goal || "Lead Generation & Free Roof Inspection Quotes"}
- Target Audience: ${targetAudience || "Homeowners aged 30-65 needing roof repair, replacement, or storm damage inspection"}
- Brand Tone: ${tone || "High-converting & Direct"}
${customPrompt ? `- Additional Guidelines: ${customPrompt}` : ""}

Respond STRICTLY in JSON format with the following fields:
- headline: A catchy, high-stopping headline for the post.
- post: The full Facebook post body copy, including emojis, line breaks and persuasive formatting.
- cta: A clear, compelling Call To Action button/text (e.g. "\u{1F449} Tap link to claim your free roof inspection!").
- targetAudience: Specific target audience summary.
- imagePrompt: A detailed, high-quality prompt for AI image generation (e.g., Gemini/Midjourney) visual asset.
- hashtags: An array of 5-8 relevant hashtags strings (e.g., ["#RoofingContractor", "#HomeImprovement"]).`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            headline: { type: import_genai.Type.STRING },
            post: { type: import_genai.Type.STRING },
            cta: { type: import_genai.Type.STRING },
            targetAudience: { type: import_genai.Type.STRING },
            imagePrompt: { type: import_genai.Type.STRING },
            hashtags: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING }
            }
          },
          required: ["headline", "post", "cta", "targetAudience", "imagePrompt", "hashtags"]
        }
      }
    });
    const contentText = response.text || "{}";
    const parsed = JSON.parse(contentText);
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Gemini content generation error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate content" });
  }
});
app.post("/api/market-research", async (req, res) => {
  try {
    const { topic, niche, competitorFocus, targetMarket } = req.body;
    const ai = getGenAiClient();
    if (!ai) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY environment variable is missing on server."
      });
    }
    let externalLiveContext = "";
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (tavilyKey && (topic || niche)) {
      try {
        const tavilyQuery = `${topic || niche} market trends competitor pricing marketing strategy 2026`;
        const tavilyRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: tavilyQuery,
            search_depth: "basic",
            max_results: 3
          })
        });
        if (tavilyRes.ok) {
          const tavilyData = await tavilyRes.json();
          if (tavilyData.results && Array.isArray(tavilyData.results)) {
            externalLiveContext = tavilyData.results.map((r) => `[${r.title}]: ${r.content}`).join("\n\n");
          }
        }
      } catch (tavilyErr) {
        console.warn("[Market Research] Tavily search fallback notice:", tavilyErr);
      }
    }
    const systemInstruction = `You are the Chief Market Intelligence & Research AI Agent for ZA Media AI Growth Engine.
Your role is to conduct in-depth competitive market analyses, identify underserved market gaps, recommend high-margin digital products/service packages, and generate battle-tested marketing hooks.`;
    const prompt = `Conduct a comprehensive market research and intelligence report on the following parameters:
- Industry / Niche: ${niche || "B2B AI Automation & Growth Marketing"}
- Research Focus / Topic: ${topic || "High-Ticket Agency Services & Digital Products"}
- Competitor Targets: ${competitorFocus || "Top Agency Competitors & SaaS tools"}
- Target Customer Profile: ${targetMarket || "SMB Owners, Marketing Directors, Agency Founders"}
${externalLiveContext ? `
Live Search Intel Found:
${externalLiveContext}` : ""}

Respond STRICTLY in JSON format with the following structure:
- executiveSummary: String (2-3 concise sentences summarizing the market opportunity).
- marketSizeGrowth: String (estimated market dynamics, CAGR, or current demand index).
- keyTrends: Array of 3-5 strings detailing actionable emerging industry trends.
- competitorAnalysis: Array of 3-4 objects with: { competitorName: String, positioning: String, pricingModel: String, vulnerabilities: String }.
- identifiedGaps: Array of 3-4 strings identifying underserved client pain points.
- recommendedOffers: Array of 2-3 objects with: { offerTitle: String, targetPrice: String, deliverableFormat: String, estimatedMargin: String, whyItWins: String }.
- viralHooksAndAngles: Array of 4-6 strings containing punchy hook lines for social ads, email, and organic content.
- opportunityScore: Number (0-100) representing commercial viability and execution ease.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            executiveSummary: { type: import_genai.Type.STRING },
            marketSizeGrowth: { type: import_genai.Type.STRING },
            keyTrends: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING }
            },
            competitorAnalysis: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  competitorName: { type: import_genai.Type.STRING },
                  positioning: { type: import_genai.Type.STRING },
                  pricingModel: { type: import_genai.Type.STRING },
                  vulnerabilities: { type: import_genai.Type.STRING }
                },
                required: ["competitorName", "positioning", "pricingModel", "vulnerabilities"]
              }
            },
            identifiedGaps: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING }
            },
            recommendedOffers: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  offerTitle: { type: import_genai.Type.STRING },
                  targetPrice: { type: import_genai.Type.STRING },
                  deliverableFormat: { type: import_genai.Type.STRING },
                  estimatedMargin: { type: import_genai.Type.STRING },
                  whyItWins: { type: import_genai.Type.STRING }
                },
                required: ["offerTitle", "targetPrice", "deliverableFormat", "estimatedMargin", "whyItWins"]
              }
            },
            viralHooksAndAngles: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING }
            },
            opportunityScore: { type: import_genai.Type.INTEGER }
          },
          required: [
            "executiveSummary",
            "marketSizeGrowth",
            "keyTrends",
            "competitorAnalysis",
            "identifiedGaps",
            "recommendedOffers",
            "viralHooksAndAngles",
            "opportunityScore"
          ]
        }
      }
    });
    const contentText = response.text || "{}";
    const parsed = JSON.parse(contentText);
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Market research API error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to conduct market research" });
  }
});
app.get("/api/system-diagnostics", async (req, res) => {
  const results = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    gemini: { status: "unknown", latencyMs: 0 },
    supabase: { status: "unknown", tables: [] },
    n8n: { status: "unknown", endpoint: process.env.VITE_N8N_WEBHOOK_URL || "https://enjywork.app.n8n.cloud/webhook/af61c8ab-cc19-4c8d-aa96-3ad5f55f10a6" },
    tavily: { status: "unknown" }
  };
  try {
    const ai = getGenAiClient();
    if (ai) {
      const start = Date.now();
      await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: "Respond with single word: OK"
      });
      results.gemini = { status: "healthy", latencyMs: Date.now() - start };
    } else {
      results.gemini = { status: "missing_key", latencyMs: 0 };
    }
  } catch (err) {
    results.gemini = { status: "error", latencyMs: 0 };
  }
  try {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.from("leads").select("id").limit(1);
      if (!error) {
        results.supabase = { status: "healthy", tables: ["leads", "audit_logs", "income_records", "content_posts"] };
      } else {
        results.supabase = { status: "warning", tables: [] };
      }
    } else {
      results.supabase = { status: "missing_key", tables: [] };
    }
  } catch {
    results.supabase = { status: "error", tables: [] };
  }
  try {
    const n8nUrl = results.n8n.endpoint;
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ping: true, checkTime: (/* @__PURE__ */ new Date()).toISOString() })
    });
    results.n8n.status = n8nRes.ok || n8nRes.status === 200 ? "healthy" : n8nRes.status === 404 ? "inactive_workflow" : `http_${n8nRes.status}`;
  } catch {
    results.n8n.status = "network_unreachable";
  }
  results.tavily = { status: process.env.TAVILY_API_KEY ? "configured" : "fallback_mode" };
  res.json({ success: true, diagnostics: results });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
var server_default = app;
if (process.env.VERCEL !== "1") {
  startServer().catch((error) => {
    console.error("Failed to start ZA Media server:", error);
    process.exitCode = 1;
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app
});
//# sourceMappingURL=server.cjs.map
