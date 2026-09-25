import net from "node:net";
import { decodeHsfzFrames, encodeHsfzFrame } from "./enetObd.ts";

/** Isolated loopback protocol fixture. Never imported by the production bridge/browser. */
export async function mockEnetVehicle(options: { delayMs?: number; identity?: "negative" | "timeout" | "positive"; injectUnrelated?: boolean } = {}) {
  const sockets = new Set<net.Socket>();
  const requests: { service: number; parameters: number[]; at: number }[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const server = net.createServer(socket => {
    socket.setNoDelay(true); sockets.add(socket); socket.on("close", () => sockets.delete(socket)); socket.on("error", () => {});
    let remainder: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    socket.on("data", chunk => {
      remainder = Buffer.concat([remainder, chunk]); const decoded = decodeHsfzFrames(remainder); remainder = decoded.remainder;
      for (const frame of decoded.frames) {
        const service = frame.payload[2], parameters = [...frame.payload.slice(3)]; requests.push({ service, parameters, at: performance.now() });
        if (service === 0x22 && options.identity === "timeout") continue;
        let response: number[];
        if (service === 0x22) response = options.identity === "positive" ? [0x12, 0xf4, 0x62, ...parameters, ...Buffer.from("00003076501103")] : [0x12, 0xf4, 0x7f, 0x22, 0x31];
        else if ([0, 0x20, 0x40].includes(parameters[0])) response = [0x12, 0xf4, 0x41, parameters[0], 255, 255, 255, 255];
        else response = [0x12, 0xf4, 0x41, parameters[0], parameters[0] === 0x0c ? 0x1f : 100, parameters[0] === 0x0c ? 0x40 : 0];
        if (options.injectUnrelated) socket.write(encodeHsfzFrame(1, Uint8Array.from([0x13, 0xf4, 0x41, parameters[0], 0, 0])));
        const timer = setTimeout(() => { timers.delete(timer); if (!socket.destroyed) socket.write(encodeHsfzFrame(1, Uint8Array.from(response))); }, options.delayMs ?? 1); timers.add(timer);
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  return { port, requests, close: async () => { for (const timer of timers) clearTimeout(timer); for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
