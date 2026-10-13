export function resolveMetaGraphApiVersion(env = process.env) {
  const configured = (env.META_GRAPH_API_VERSION ?? "").trim();
  const version = configured || "v26.0";
  const match = /^v(\\d+)\\.0$/.exec(version);
  if (!match) {
    throw new Error("META_GRAPH_API_VERSION must be a stable major version such as v26.0.");
  }
  if (Number(match[1]) < 26) {
    throw new Error("META_GRAPH_API_VERSION must be v26.0 or newer.");
  }
  return version;
}
