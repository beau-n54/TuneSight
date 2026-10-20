import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(new URL("./vehicleOwnedTuneRead.server.ts", import.meta.url), "utf8"),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;

function harness(options: {foreign?: boolean; infoSize?: number; stock?: boolean; software?: string; ready?: boolean} = {}) {
  const bytes = new Uint8Array([1, 2, 3, 4]), reads: unknown[] = [], calls: unknown[] = [];
  const data = {storage_path: options.foreign ? "foreign/file" : "owner/vehicle/file", file_name: "uninformative.bin", created_at: "2026-01-01T00:00:00Z", is_stock_reference: options.stock ?? true};
  const q = {
    select: () => q,
    eq: (key: string, value: string) => {reads.push([key, value]); return q;},
    maybeSingle: async () => ({data}),
  };
  // No writer exists at either boundary. Production code must use only reads.
  const client = {from: () => q, storage: {from: () => ({
    info: async () => ({data: {size: options.infoSize ?? bytes.length}}),
    download: async () => ({data: new Blob([bytes]), error: null}),
  })}};
  const mod = {exports: {} as {readVehicleOwnedTune: (input: unknown) => Promise<unknown>}};
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "server-only") return {};
    if (id.includes("trustedServer")) return {createTrustedServerClient: () => client};
    if (id.includes("uploadPolicy")) return {ownedStoragePath: (p: string, owner: string, vehicle: string) => p.startsWith(`${owner}/${vehicle}/`), TUNE_MAX_BYTES: 100};
    if (id.includes("binaryContainer")) return {resolveBinaryContainer: () => ({status: "resolved", engineeringBinary: {bytes, byteLength: bytes.length}})};
    if (id.includes("subscriberCalibrationProvider")) return {loadSubscriberCalibration: async (input: unknown) => {calls.push(input); return {status: options.ready === false ? "unavailable" : "workshop_ready", identity: options.software ?? "ROM"};}};
    return require(id);
  }, mod, mod.exports);
  const input = {ownerId: "owner", vehicleId: "vehicle", tuneId: "tune",
    locator: {digest: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.length, software: "ROM"}};
  return {read: mod.exports.readVehicleOwnedTune, input, reads, calls, data};
}
test("hash locator independently reads exact owned bytes and freshly invokes admission without writes or role changes", async () => {
  const h = harness(), before = JSON.stringify(h.data);
  assert(await h.read(h.input));
  assert.deepEqual(h.reads, [["id","tune"],["vehicle_id","vehicle"],["user_id","owner"]]);
  assert.equal(h.calls.length, 1); assert.equal(JSON.stringify(h.data), before);
});
for (const kind of ["hash", "length", "software", "foreign", "transport-length", "provider-rejection"] as const) {
  test(`durable admission rejects ${kind}`, async () => {
    const h = harness({foreign: kind === "foreign", infoSize: kind === "transport-length" ? 3 : undefined,
      software: kind === "software" ? "wrong" : undefined, ready: kind !== "provider-rejection"});
    if (kind === "hash") h.input.locator.digest = "0".repeat(64);
    if (kind === "length") h.input.locator.byteLength = 5;
    assert.equal(await h.read(h.input), null);
    if (["hash","length","foreign","transport-length"].includes(kind)) assert.equal(h.calls.length, 0);
  });
}
test("ordinary Current recovery cannot silently use a Stock Reference", async () => {
  const h = harness();
  assert.equal(await h.read({...h.input, locator: undefined}), null);
  assert.equal(h.calls.length, 0);
});
