import dgram from "node:dgram";
import { isIPv4 } from "node:net";
import { ENET_DISCOVERY_PORT, encodeHsfzFrame } from "./enetObd.ts";

export type EnetInterface = Readonly<{ address: string; netmask: string }>;
export type EnetTarget = Readonly<{ host: string; localAddress: string }>;
/** Automatic direct-cable support is deliberately limited to Windows link-local IPv4.
 * No adapter settings, routes or IP addresses are changed. Wi-Fi is never a candidate.
 */
export function supportedEnetInterface(value: EnetInterface): boolean {
  return isIPv4(value.address) && /^169\.254\.(?!0\.|255\.)/.test(value.address) && value.netmask === "255.255.0.0";
}
export async function discoverEnet(interfaces: readonly EnetInterface[], options: { port?: number; timeoutMs?: number } = {}): Promise<EnetTarget> {
  const candidates = interfaces.filter(supportedEnetInterface);
  if (!candidates.length) throw new Error("unsupported_network");
  return discoverOnInterfaces(candidates, options);
}
/** Exported for controlled loopback transport tests; the desktop calls discoverEnet. */
export function discoverOnInterfaces(interfaces: readonly EnetInterface[], options: { port?: number; timeoutMs?: number; destination?: string } = {}): Promise<EnetTarget> {
  return new Promise((resolve, reject) => {
    const sockets: dgram.Socket[] = [];
    let settled = false, remaining = interfaces.length;
    const finish = (target?: EnetTarget, error = "vehicle_discovery_timeout") => {
      if (settled) return; settled = true; clearTimeout(timer);
      for (const socket of sockets) { try { socket.close(); } catch { /* bind may have failed */ } }
      if (target) resolve(target); else reject(new Error(error));
    };
    const timer = setTimeout(() => finish(), options.timeoutMs ?? 3500);
    if (!remaining) { finish(undefined, "unsupported_network"); return; }
    for (const candidate of interfaces) {
      const socket = dgram.createSocket("udp4"); sockets.push(socket);
      let failed = false;
      const failInterface = () => { if (!failed) { failed = true; if (--remaining === 0) finish(undefined, "unsupported_network"); } };
      socket.on("error", failInterface);
      socket.on("message", (packet, remote) => {
        // BMW discovery response is HSFZ identification (0x11). Never accept arbitrary UDP.
        // Treat this only as a transport candidate: Mode 01 response from DME 0x12 is still required.
        if (packet.length < 7 || packet.length > 65542 || packet.readUInt32BE(0) !== packet.length - 6 || packet.readUInt16BE(4) !== 0x11) return;
        if (remote.port !== (options.port ?? ENET_DISCOVERY_PORT) || !isIPv4(remote.address)) return;
        const local = candidate.address.split(".").map(Number), mask = candidate.netmask.split(".").map(Number), host = remote.address.split(".").map(Number);
        if (host.some((byte, i) => (byte & mask[i]) !== (local[i] & mask[i])) || remote.address === candidate.address) return;
        finish({ host: remote.address, localAddress: candidate.address });
      });
      socket.bind(0, candidate.address, () => {
        if (settled) return;
        try {
          socket.setBroadcast(true);
          const broadcast = candidate.address.split(".").map((part, i) => Number(part) | (255 ^ Number(candidate.netmask.split(".")[i]))).join(".");
          socket.send(encodeHsfzFrame(0x11, new Uint8Array()), options.port ?? ENET_DISCOVERY_PORT, options.destination ?? broadcast, error => { if (error) failInterface(); });
        } catch { failInterface(); }
      });
    }
  });
}
