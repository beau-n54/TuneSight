import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

const moduleUrl = new URL("./subscriberWorkshopSessionStore.ts", import.meta.url).href;
function serverProcess(source: string): string {
  return execFileSync(process.execPath, ["--conditions=react-server", "--input-type=module", "--eval", source], { encoding: "utf8", cwd: process.cwd() }).trim();
}

test("Route Handler-issued subscriber session resolves in a separate Server Component process", () => {
  const token = serverProcess(`const store = await import(${JSON.stringify(moduleUrl)}); store.clearSubscriberWorkshopSessionsForTests(); const result = Object.freeze({ status: "invalid_upload", title: "proof", message: "proof", identity: null, digest: null, container: null, byteLength: null, coverage: null, timings: Object.freeze({}) }); console.log(store.createSubscriberWorkshopSession("founder", "vehicle", result));`);
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);

  const resolution = JSON.parse(serverProcess(`const store = await import(${JSON.stringify(moduleUrl)}); const result = store.readSubscriberWorkshopSession(${JSON.stringify(token)}, "founder", "vehicle"); console.log(JSON.stringify({ status: result?.status ?? null, wrongOwner: store.readSubscriberWorkshopSession(${JSON.stringify(token)}, "other", "vehicle") }));`)) as { status: string | null; wrongOwner: unknown };
  assert.equal(resolution.status, "invalid_upload");
  assert.equal(resolution.wrongOwner, null);
  serverProcess(`const store = await import(${JSON.stringify(moduleUrl)}); store.clearSubscriberWorkshopSessionsForTests();`);
});
