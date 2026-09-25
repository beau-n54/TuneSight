import { createInterface } from "node:readline";
import { createVehicleBridge, EnetReadOnlyConnection } from "../../scripts/tunesightVehicleBridge.ts";
import { DESKTOP_BRIDGE_COMPATIBILITY } from "../../lib/vehicle-interface/bridgeVersion.ts";
import { trustedBridgeOrigins } from "../../lib/vehicle-interface/bridgeSecurity.ts";
import { discoverEnet, supportedEnetInterface, type EnetInterface } from "../../lib/vehicle-interface/enetDiscovery.ts";

// Parent/child private standard streams carry adapter candidates and allowlisted categories.
// No token, VIN, sample, exception, interface name, IP or MAC is written to stdout/stderr.
let interfaces: EnetInterface[] = [], ethernetUp = false, networkAt = 0;
const emit = (category: string) => process.stdout.write(`TSB:${category}\n`);
const connection = new EnetReadOnlyConnection(undefined, undefined, undefined, async () => {
  if (Date.now() - networkAt > 10000) throw new Error("unsupported_network");
  if (!ethernetUp) throw new Error("enet_cable_missing");
  return discoverEnet(interfaces);
});
const server = createVehicleBridge({ connection, origins: trustedBridgeOrigins(undefined), version: DESKTOP_BRIDGE_COMPATIBILITY, onState: emit });
let stopping = false;
function stop() {
  if (stopping) return; stopping = true; connection.disconnect();
  clearInterval(health); input.close(); server.closeAllConnections();
  server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1000).unref();
}
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", line => {
  if (line === "quit") { stop(); return; }
  try {
    if (line.length > 16384) throw new Error();
    const value = JSON.parse(line);
    if (value.kind !== "network" || typeof value.ethernetUp !== "boolean" || !Array.isArray(value.interfaces) || value.interfaces.length > 32) throw new Error();
    const next: EnetInterface[] = value.interfaces.filter((v: unknown): v is EnetInterface => Boolean(v && typeof v === "object" && "address" in v && typeof v.address === "string" && "netmask" in v && typeof v.netmask === "string" && supportedEnetInterface(v as EnetInterface)));
    if (connection.session && interfaces.some(old => !next.some(v => v.address === old.address))) { connection.disconnect(); emit("disconnected"); }
    interfaces = next; ethernetUp = value.ethernetUp; networkAt = Date.now();
    emit(!ethernetUp ? "cable_missing" : interfaces.length ? "ethernet_ready" : "unsupported_network");
  } catch { interfaces = []; ethernetUp = false; networkAt = 0; connection.disconnect(); emit("unsupported_network"); }
});
input.on("close", stop);
let wasConnected = false;
const health = setInterval(() => {
  const connected = Boolean(connection.session);
  if (wasConnected && !connected) emit("disconnected");
  wasConnected = connected;
}, 1000);
server.on("error", (error: NodeJS.ErrnoException) => { emit(error.code === "EADDRINUSE" ? "port_occupied" : "startup_failed"); stop(); });
process.on("uncaughtException", () => { emit("runtime_failed"); stop(); });
process.on("unhandledRejection", () => { emit("runtime_failed"); stop(); });
server.listen(57631, "127.0.0.1", () => emit("ready"));
