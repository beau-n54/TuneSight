import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import dgram from "node:dgram";
import http from "node:http";
import net from "node:net";
import { pathToFileURL } from "node:url";
import { ENET_DISCOVERY_PORT, ENET_HSFZ_PORT, ENET_OBD_CHANNELS, decodeHsfzFrames, encodeDmeRequest, encodeHsfzFrame, parseObdResponse, supportedPids } from "../lib/vehicle-interface/enetObd.ts";
import { bridgeOriginAllowed, trustedBridgeOrigins } from "../lib/vehicle-interface/bridgeSecurity.ts";
import type { LiveSample } from "../lib/vehicle-interface/liveTelemetryPresentation.ts";

const bind = "127.0.0.1";
export class EnetReadOnlyConnection {
  private socket: net.Socket | null = null;
  private generation = 0;
  private remainder: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  session: { id: string; host: string; identity: Record<string, string | null>; identityReads: Record<string, string>; supported: Set<number>; nextSequenceByKey: Map<string, number>; lastDeliveredByKey: Map<string, number> } | null = null;
  private readonly host?: string;
  private readonly vehiclePort: number;
  private readonly timeoutMs: number;
  constructor(host?: string, vehiclePort = ENET_HSFZ_PORT, timeoutMs = 2500) { this.host = host; this.vehiclePort = vehiclePort; this.timeoutMs = timeoutMs; }
  private async discover(): Promise<string> {
    if (this.host) return this.host;
    return new Promise((resolve, reject) => {
      const udp = dgram.createSocket("udp4");
      const timer = setTimeout(() => { udp.close(); reject(new Error("vehicle_discovery_timeout")); }, 3500);
      udp.once("error", error => { clearTimeout(timer); udp.close(); reject(error); });
      udp.once("message", (_message, remote) => { clearTimeout(timer); udp.close(); resolve(remote.address); });
      udp.bind(() => { udp.setBroadcast(true); udp.send(encodeHsfzFrame(0x0011, new Uint8Array()), ENET_DISCOVERY_PORT, "255.255.255.255"); });
    });
  }
  private transact(service: number, parameters: readonly number[]): Promise<Uint8Array> {
    const socket = this.socket;
    if (!socket || socket.destroyed) return Promise.reject(new Error("vehicle_not_connected"));
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); socket.off("data", onData); socket.off("error", onError); socket.off("close", onClose); };
      const fail = (error: Error) => { cleanup(); reject(error); };
      const timer = setTimeout(() => { fail(new Error("vehicle_response_timeout")); if (this.socket === socket) { socket.destroy(); this.socket = null; this.session = null; this.remainder = Buffer.alloc(0); } }, this.timeoutMs);
      const onError = (error: Error) => fail(error);
      const onClose = () => fail(new Error("vehicle_connection_closed"));
      const onData = (chunk: Buffer) => {
        try {
          this.remainder = Buffer.concat([this.remainder, chunk]);
          const decoded = decodeHsfzFrames(this.remainder); this.remainder = decoded.remainder;
          for (const frame of decoded.frames) {
            const p = frame.payload;
            if (frame.type !== 1 || p[0] !== 0x12 || p[1] !== 0xf4) continue;
            if (p[2] === 0x7f && p[3] === service) {
              if (p[4] === 0x78) continue; // Response pending, within the existing bounded deadline.
              fail(new Error(`negative_response_0x${p[4]?.toString(16).padStart(2, "0") ?? "missing"}`)); return;
            }
            if (p[2] !== service + 0x40 || !parameters.every((v, i) => p[3 + i] === v)) continue;
            cleanup(); resolve(p); return;
          }
        } catch (error) { fail(error instanceof Error ? error : new Error("invalid_frame")); this.disconnect(); }
      };
      socket.on("data", onData); socket.once("error", onError); socket.once("close", onClose);
      socket.write(encodeDmeRequest(service, parameters));
    });
  }
  private async openSocket(host: string) {
    const socket = net.createConnection({ host, port: this.vehiclePort }); this.socket = socket;
    socket.setNoDelay(true);
    // A socket error outside a transaction must not crash the bridge.
    socket.on("error", () => { if (this.socket === socket) this.session = null; });
    socket.on("close", () => { if (this.socket === socket) this.session = null; });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { socket.destroy(); reject(new Error("vehicle_connect_timeout")); }, 3500);
      socket.once("connect", () => { clearTimeout(timer); resolve(); });
      socket.once("error", error => { clearTimeout(timer); reject(error); });
    });
    return socket;
  }
  async connect() {
    this.disconnect(); const generation = this.generation, host = await this.discover();
    if (generation !== this.generation) throw new Error("connection_cancelled");
    let socket = await this.openSocket(host);
    const supported = new Set<number>(); let responseObserved = false;
    for (const base of [0x00, 0x20, 0x40]) {
      try { for (const pid of supportedPids(base, await this.transact(0x01, [base]))) supported.add(pid); responseObserved = true; }
      catch (error) { if (socket.destroyed) throw error; }
    }
    if (!responseObserved) throw new Error("dme_support_not_observed");
    const identity: Record<string, string | null> = { dme: "BMW DME response observed at logical address 0x12", vin: null, applicationSoftwareVersion: null, sparePartNumber: null, romSoftwareIdentity: null };
    const identityReads: Record<string, string> = {};
    for (const [name, did] of [["vin", 0xf190], ["applicationSoftwareVersion", 0xf189], ["sparePartNumber", 0xf187]] as const) {
      try {
        const response = await this.transact(0x22, [did >> 8, did & 0xff]);
        const bytes = Buffer.from(response.slice(5));
        const text = bytes.toString("ascii").replaceAll("\0", "").trim();
        if (!bytes.length || !/^[\x20-\x7e]+$/.test(text) || bytes.some(v => v > 127)) identityReads[name] = "empty_or_non_ascii_response";
        else { identity[name] = text; identityReads[name] = "observed_positive_response"; }
      } catch (error) { identityReads[name] = error instanceof Error ? error.message : "read_failed"; if (socket.destroyed) break; }
    }
    if (generation !== this.generation) throw new Error("connection_cancelled");
    if (socket.destroyed) {
      // Identity timeout does not become a fabricated identity or poison the next PID response.
      // Discard that socket, reopen and independently verify support before allowing live reads.
      socket = await this.openSocket(host);
      const reobserved = new Set<number>();
      for (const base of [0x00, 0x20, 0x40]) for (const pid of supportedPids(base, await this.transact(0x01, [base]))) reobserved.add(pid);
      if (supported.size !== reobserved.size || [...supported].some(pid => !reobserved.has(pid))) throw new Error("support_changed_after_identity_timeout");
    }
    if (generation !== this.generation || socket.destroyed) throw new Error("connection_cancelled");
    for (const name of ["vin", "applicationSoftwareVersion", "sparePartNumber"]) identityReads[name] ??= "not_attempted_after_transport_timeout";
    // These generic DIDs do not establish the exact BMW ROM family. Never inject expected offline identity.
    this.session = { id: randomUUID(), host, identity, identityReads, supported, nextSequenceByKey: new Map(), lastDeliveredByKey: new Map() };
    return this.publicSession();
  }
  publicSession() { const s = this.session; return s ? { id: s.id, host: s.host, identity: s.identity, identityReads: s.identityReads } : null; }
  async sample(keys: readonly string[]) {
    const session = this.session;
    if (!session) throw new Error("vehicle_not_connected");
    const rows: LiveSample[] = [], completed = new Map<string, number>();
    for (const key of [...new Set(keys)]) {
      const definition = ENET_OBD_CHANNELS.find(v => v.channel.channelKey === key);
      if (!definition || !session.supported.has(definition.pid)) { rows.push({ key, state: "unsupported" }); continue; }
      const sequence = session.nextSequenceByKey.get(key) ?? 0; session.nextSequenceByKey.set(key, sequence + 1);
      const requestStartedAt = new Date().toISOString(), started = performance.now();
      try {
        const value = parseObdResponse({ pid: definition, payload: await this.transact(0x01, [definition.pid]) });
        if (this.session !== session) throw new Error("session_changed");
        const receivedAt = new Date().toISOString(), transactionMs = performance.now() - started;
        const previous = session.lastDeliveredByKey.get(key); session.lastDeliveredByKey.set(key, sequence); completed.set(key, performance.now());
        rows.push({ key, state: "valid", value, unit: definition.channel.unit, channelRevisionId: definition.channel.revisionId, sequence,
          acquiredAt: receivedAt, receivedAt, latencyMs: transactionMs, droppedSincePrevious: previous === undefined ? 0 : Math.max(0, sequence - previous - 1),
          timing: { requestStartedAt, responseReceivedAt: receivedAt, responseReadyAt: receivedAt, transactionMs, batchWaitMs: 0 } });
      } catch (error) {
        rows.push({ key, state: "invalid", sequence, receivedAt: new Date().toISOString(), latencyMs: performance.now() - started, finding: error instanceof Error ? error.message : "read_failed" });
        if (!this.session) throw error;
      }
    }
    const responseReadyAt = new Date().toISOString(), ready = performance.now();
    return rows.map(row => row.timing ? { ...row, timing: { ...row.timing, responseReadyAt, batchWaitMs: ready - completed.get(row.key)! } } : row);
  }
  disconnect() { this.generation++; this.socket?.destroy(); this.socket = null; this.session = null; this.remainder = Buffer.alloc(0); }
}
export function createVehicleBridge(options: { token: string; origins: ReadonlySet<string>; connection: EnetReadOnlyConnection }) {
  if (options.token.length < 32) throw new Error("bridge_token_requires_at_least_32_characters");
  let busy = false;
  const { connection } = options;
  function json(res: http.ServerResponse, status: number, value: unknown) { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); }
  async function body(req: http.IncomingMessage) {
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) { const value = Buffer.from(chunk); size += value.length; if (size > 16_384) throw new Error("payload_too_large"); chunks.push(value); }
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown> : {};
  }
  const server = http.createServer(async (req, res) => {
    const address = server.address();
    if (!bridgeOriginAllowed(req.headers.origin, req.headers.host, options.origins, typeof address === "object" && address ? address.port : 57631)) return json(res, 403, { error: "origin_or_host_not_allowed" });
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin!); res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "authorization,content-type"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      if (!["GET", "POST"].includes(String(req.headers["access-control-request-method"])) || String(req.headers["access-control-request-headers"] ?? "").split(",").some(h => h.trim() && !["authorization", "content-type"].includes(h.trim().toLowerCase()))) return json(res, 403, { error: "preflight_not_allowed" });
      if (req.headers["access-control-request-private-network"] === "true") res.setHeader("Access-Control-Allow-Private-Network", "true");
      res.setHeader("Access-Control-Max-Age", "600"); return res.writeHead(204).end();
    }
    const supplied = Buffer.from(req.headers.authorization ?? ""), expected = Buffer.from(`Bearer ${options.token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return json(res, 401, { error: "authentication_failed" });
    if (req.method === "GET" && req.url === "/v1/status") return json(res, 200, { state: connection.session ? "connected" : "ready", authenticatedSession: Boolean(connection.session), session: connection.publicSession() });
    if (req.method === "POST" && req.url === "/v1/disconnect") { connection.disconnect(); return json(res, 200, { state: "disconnected" }); }
    if (busy) return json(res, 409, { error: "bridge_busy" });
    busy = true;
    try {
      if (req.method === "POST" && req.url === "/v1/connect") return json(res, 200, { session: await connection.connect(), channels: ENET_OBD_CHANNELS.map(v => ({ key: v.channel.channelKey, unit: v.channel.unit, revisionId: v.channel.revisionId, state: connection.session!.supported.has(v.pid) ? "qualified_available" : "unsupported" })) });
      if (req.method === "POST" && req.url === "/v1/sample") {
        const input = await body(req);
        if (!Array.isArray(input.channels) || !input.channels.length || input.channels.length > 16 || input.channels.some(k => typeof k !== "string" || !ENET_OBD_CHANNELS.some(v => v.channel.channelKey === k))) return json(res, 400, { error: "invalid_channel_selection" });
        return json(res, 200, { samples: await connection.sample(input.channels) });
      }
      return json(res, 404, { error: "operation_not_allowed" });
    } catch (error) { connection.disconnect(); return json(res, 503, { error: error instanceof Error ? error.message : "bridge_failure" }); }
    finally { busy = false; }
  });
  server.requestTimeout = 10_000;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.TUNESIGHT_BRIDGE_TOKEN ?? randomBytes(24).toString("base64url");
  const origins = trustedBridgeOrigins(process.env.TUNESIGHT_BRIDGE_ALLOWED_ORIGINS), connection = new EnetReadOnlyConnection(process.env.TUNESIGHT_ENET_HOST);
  const server = createVehicleBridge({ token, origins, connection });
  server.listen(57631, bind, () => { console.log(`TuneSight read-only ENET bridge: http://${bind}:57631`); console.log(`Session token: ${token}`); console.log(`Allowed origins: ${[...origins].join(", ")}`); console.log("No write, flash, coding, DTC-clear, adaptation, actuator, or raw-proxy route exists."); });
  process.on("SIGINT", () => { connection.disconnect(); server.close(() => process.exit(0)); });
}
