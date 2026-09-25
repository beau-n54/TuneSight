/** Read-only loopback benchmark. Synthetic HSFZ responder, never a vehicle. */
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import net from "node:net";
import { EnetReadOnlyConnection, createVehicleBridge } from "./tunesightVehicleBridge.ts";
import { mockEnetVehicle } from "../lib/vehicle-interface/enetBridge.fixtures.ts";
import { ENET_OBD_CHANNELS } from "../lib/vehicle-interface/enetObd.ts";
import { createTelemetryScheduler } from "../lib/vehicle-interface/liveTelemetryScheduler.ts";
import { trustedBridgeOrigins } from "../lib/vehicle-interface/bridgeSecurity.ts";
import type { LiveSample } from "../lib/vehicle-interface/liveTelemetryPresentation.ts";

const origin = "http://localhost:3000", token = "synthetic-benchmark-token-not-a-vehicle-secret";
const keys = ENET_OBD_CHANNELS.map(x => x.channel.channelKey), selected = [...keys, "boost.actual"];
const mock = await mockEnetVehicle({ delayMs: 30 });
const temp = await mkdtemp(path.join(tmpdir(), "tunesight-telemetry-bench-"));
const reservation = net.createServer(); await new Promise<void>(resolve => reservation.listen(0, "127.0.0.1", resolve));
const beforePort = (reservation.address() as net.AddressInfo).port; await new Promise<void>(resolve => reservation.close(() => resolve()));
const source = execFileSync("git", ["show", "8b9cba798459a11becb2fb25037d22325e93a6ce:scripts/tunesightVehicleBridge.ts"], { encoding: "utf8" })
  .replace('"../lib/vehicle-interface/enetObd.ts"', JSON.stringify(pathToFileURL(path.resolve("lib/vehicle-interface/enetObd.ts")).href))
  .replace("port = 57631", `port = ${beforePort}`).replace("port: ENET_HSFZ_PORT", `port: ${mock.port}`);
const baselinePath = path.join(temp, "baseline.mts"); await writeFile(baselinePath, source);
const baseline = spawn(process.execPath, ["--experimental-strip-types", baselinePath], { env: { ...process.env, TUNESIGHT_ENET_HOST: "127.0.0.1", TUNESIGHT_BRIDGE_TOKEN: token, TUNESIGHT_BRIDGE_ALLOWED_ORIGINS: origin }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
const connection = new EnetReadOnlyConnection("127.0.0.1", mock.port), server = createVehicleBridge({ connection, token, origins: trustedBridgeOrigins(origin) });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const summaries = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return { count: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length, median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] }; };
const call = async (port: number, route: string, channels?: string[]) => {
  const response = await fetch(`http://127.0.0.1:${port}/v1/${route}`, { method: "POST", headers: { Origin: origin, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ channels }) });
  if (!response.ok) throw new Error(`bench_http_${response.status}`); return response.json();
};
async function measure(mode: "before" | "after", port: number) {
  await call(port, "connect"); const scheduler = createTelemetryScheduler(), started = performance.now(), arrivals = new Map<string, number[]>(), raw: unknown[] = [];
  const rpmResponseToClient: number[] = [], rpmTransaction: number[] = [], httpTimes: number[] = [];
  while (performance.now() - started < 15_000) {
    const next = mode === "before" ? { channels: keys, waitMs: 0 } : scheduler.next(selected, performance.now());
    if (!next.channels.length) { await wait(next.waitMs); continue; }
    const sent = performance.now(); const payload = await call(port, "sample", next.channels); const received = performance.now(); httpTimes.push(received - sent);
    for (const s of payload.samples as LiveSample[]) {
      if (s.state !== "valid") throw new Error("fixture_sample_failed");
      arrivals.set(s.key, [...(arrivals.get(s.key) ?? []), received - started]);
      if (s.key === "engine.speed") { rpmResponseToClient.push(Date.now() - Date.parse(s.receivedAt!)); rpmTransaction.push(s.latencyMs!); }
      raw.push({ key: s.key, atClientMs: received - started, requestToResponseMs: s.latencyMs, bridgeReceivedAt: s.receivedAt, timing: s.timing });
    }
    if (mode === "before") await wait(Math.max(0, 750 - (performance.now() - sent)));
  }
  await call(port, "disconnect");
  return { mode, elapsedMs: performance.now() - started, channels: Object.fromEntries([...arrivals].map(([key, times]) => [key, { samples: times.length, observedHz: (times.length - 1) * 1000 / (times[times.length - 1] - times[0]), spacingMs: summaries(times.slice(1).map((v, i) => v - times[i])) }])), rpmRequestResponseMs: summaries(rpmTransaction), rpmResponseToHttpClientMs: summaries(rpmResponseToClient), httpRoundTripMs: summaries(httpTimes), raw };
}
try {
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error("baseline_start_timeout")), 5000); baseline.stdout.on("data", chunk => { if (String(chunk).includes("read-only ENET bridge:")) { clearTimeout(timer); resolve(); } }); baseline.once("exit", () => reject(new Error("baseline_exited"))); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const results = [await measure("before", beforePort), await measure("after", (server.address() as net.AddressInfo).port)];
  console.log(JSON.stringify({ evidence: "Synthetic loopback HSFZ/HTTP measurements; not physical vehicle or browser frame timings", requestedResponderDelayMs: 30, baselineCommit: "8b9cba798459a11becb2fb25037d22325e93a6ce", results }, null, 2));
} finally { baseline.kill(); connection.disconnect(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await mock.close(); if (path.dirname(path.resolve(temp)) !== path.resolve(tmpdir()) || !path.basename(temp).startsWith("tunesight-telemetry-bench-")) throw new Error("unexpected_temp_path"); await rm(temp, { recursive: true, force: true }); }
