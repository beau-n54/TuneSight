import { BRIDGE_PAIRING_CONTRACT, BRIDGE_TOKEN_LIFETIME_MS, BRIDGE_TOKEN_RENEWAL_MS, BRIDGE_URL } from "./bridgePairingContract.ts";

const messages = {
  update_required: "Update TuneSight Bridge. The installed bridge does not support this automatic pairing contract. Restart the updated Node bridge; Advanced manual pairing is available for an older bridge.",
  network_denied: "Local Network Access denied. Allow local network access for this TuneSight site in your browser's site permissions, then press Connect BMW again.",
  unavailable: "Local bridge unavailable. If the bridge is not running, start it on this laptop. If it is running, check Local Network Access permission and its exact trusted origin: an untrusted hosted origin is blocked. The browser cannot distinguish a blocked request from an offline bridge. If you are running an older bridge, Update TuneSight Bridge to support this site and automatic pairing.",
  untrusted_origin: "Untrusted hosted origin or invalid local bridge address. Use the approved TuneSight site and check the bridge's exact allowed origins; do not disable origin checks.",
  vehicle_missing: "Local bridge found, but ENET cable/DME not found or not responding. Check the cable, vehicle connection and ignition, then retry.",
  authentication_failed: "Bridge token rejected or expired. Clear the Advanced token to use automatic pairing, or supply the current token for your older bridge.",
  bridge_busy: "The local bridge is busy with another request. Wait for it to finish, then retry.",
  bridge_failure: "The local bridge could not complete the read-only request. Restart the bridge and retry; no vehicle value was inferred.",
} as const;
export class LocalBridgeError extends Error {
  readonly code: keyof typeof messages;
  constructor(code: keyof typeof messages) { super(messages[code]); this.name = "LocalBridgeError"; this.code = code; }
}
export function bridgeFailureMessage(error: unknown) {
  return error instanceof LocalBridgeError ? error.message : messages.bridge_failure;
}
async function localNetworkDenied() {
  try { return (await navigator.permissions.query({ name: "local-network-access" as PermissionName })).state === "denied"; }
  catch { return false; } // Unsupported Permissions API is unknown, not evidence of permission denial.
}

/** One client per mounted page. Secrets stay in this closure, never in returned state or storage. */
export function createLocalBridgeClient(dependencies: {
  fetch?: typeof fetch; now?: () => number; networkDenied?: () => Promise<boolean>;
} = {}) {
  const request = dependencies.fetch ?? fetch, now = dependencies.now ?? Date.now;
  const denied = dependencies.networkDenied ?? localNetworkDenied;
  let token = "", expiresAt = 0, manual = false;
  let queue: Promise<unknown> = Promise.resolve();
  // Strict Mode's setup/cleanup/setup and a Connect click share one request queue/cache.
  // Cleanup does not abort a probe that the next setup is about to reuse; fetch is time bounded.
  const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
    const pending = queue.then(action); queue = pending.catch(() => {}); return pending;
  };
  const send = async (path: string, init: RequestInit) => {
    try {
      return await request(`${BRIDGE_URL}${path}`, { ...init, cache: "no-store", credentials: "omit", redirect: "error", mode: "cors",
        signal: init.signal ?? AbortSignal.timeout(path === "/v1/connect" ? 20000 : 5000) });
    } catch {
      throw new LocalBridgeError(await denied() ? "network_denied" : "unavailable");
    }
  };
  const pair = async () => {
    if (token && (manual || expiresAt > now() + BRIDGE_TOKEN_RENEWAL_MS)) return;
    if (await denied()) throw new LocalBridgeError("network_denied");
    // application/json triggers preflight but is also allowed by the previous bridge,
    // so its readable 401/404 can be identified as an upgrade requirement.
    const response = await send("/v1/pair", { method: "GET", headers: { Accept: "application/json", "Content-Type": "application/json" } });
    if (response.status === 403) throw new LocalBridgeError("untrusted_origin");
    if ([401, 404, 405, 426].includes(response.status)) throw new LocalBridgeError("update_required");
    if (!response.ok) throw new LocalBridgeError("bridge_failure");
    const payload: unknown = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object" || !("contract" in payload) || payload.contract !== BRIDGE_PAIRING_CONTRACT
      || !("token" in payload) || typeof payload.token !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(payload.token)
      || !("expiresAt" in payload) || typeof payload.expiresAt !== "number" || !Number.isFinite(payload.expiresAt)
      || payload.expiresAt <= now() || payload.expiresAt > now() + BRIDGE_TOKEN_LIFETIME_MS + 5000) throw new LocalBridgeError("update_required");
    token = payload.token; expiresAt = payload.expiresAt; manual = false;
  };
  return {
    pair: () => enqueue(pair),
    setManualToken: (value: string) => enqueue(async () => {
      if (!value && !manual) return; // Preserve an already discovered automatic pairing.
      if (value && (value.length < 32 || value.length > 256 || /[\r\n]/.test(value))) throw new LocalBridgeError("authentication_failed");
      token = value; manual = Boolean(value); expiresAt = 0;
    }),
    call: <T>(path: "/v1/connect" | "/v1/sample" | "/v1/disconnect", init: RequestInit = {}): Promise<T> => enqueue(async () => {
      if (init.signal?.aborted) throw new LocalBridgeError("bridge_failure");
      await pair();
      const authenticated = () => send(path, { ...init, method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      let response = await authenticated();
      // 401 is returned before vehicle work. One renewal/retry handles bridge restart or expiry.
      if (response.status === 401 && !manual) { token = ""; expiresAt = 0; await pair(); response = await authenticated(); }
      if (response.status === 401) throw new LocalBridgeError("authentication_failed");
      if (response.status === 403) throw new LocalBridgeError("untrusted_origin");
      if (response.status === 409) throw new LocalBridgeError("bridge_busy");
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const code = payload?.error;
        if (["vehicle_discovery_timeout", "vehicle_connect_timeout", "vehicle_response_timeout", "vehicle_not_connected", "vehicle_connection_closed", "dme_support_not_observed"].includes(code)) throw new LocalBridgeError("vehicle_missing");
        throw new LocalBridgeError("bridge_failure");
      }
      return payload as T;
    }),
  };
}
