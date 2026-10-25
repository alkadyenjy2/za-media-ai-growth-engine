export function resolveMetaGraphApiVersion(env = process.env, now = new Date()) {
  const configured = (env.META_GRAPH_API_VERSION ?? "").trim();
  const version = configured || "v26.0";
  const match = /^v(\d+)\.0$/.exec(version);
  if (!match) {
    throw new Error("META_GRAPH_API_VERSION must be a stable major version such as v26.0.");
  }

  const major = Number(match[1]);
  const sunset = new Date("2026-10-27T00:00:00.000Z");
  if (major < 26 && now.getTime() >= sunset.getTime()) {
    const error = new Error("Meta Graph API version is below v26.0 after the 2026-10-27 sunset.");
    error.code = "migration_required";
    error.status = 503;
    throw error;
  }
  return version;
}
