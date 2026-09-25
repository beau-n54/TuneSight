export function trustedBridgeOrigins(value: string | undefined): ReadonlySet<string> {
  const entries = (value ?? "http://localhost:3000,http://127.0.0.1:3000").split(",").map(v => v.trim()).filter(Boolean);
  if (!entries.length) throw new Error("bridge_origins_required");
  for (const entry of entries) {
    const url = new URL(entry);
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (url.origin !== entry || url.username || url.password || url.hostname.includes("*") || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) throw new Error("bridge_origin_must_be_exact_https_or_loopback_origin");
  }
  return new Set(entries);
}
export function bridgeOriginAllowed(origin: string | undefined, host: string | undefined, origins: ReadonlySet<string>, port: number) {
  return Boolean(origin && origins.has(origin) && host === `127.0.0.1:${port}`);
}
