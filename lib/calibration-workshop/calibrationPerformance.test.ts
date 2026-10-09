import assert from "node:assert/strict";
import fs from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serialize } from "node:v8";
import test, { before } from "node:test";
import ts from "typescript";
import type { SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import { selectRestoredSubscriberWorkshop } from "./selectRestoredSubscriberWorkshop.ts";
import { buildSharedWorkspacePayload } from "./sharedWorkspaceAdapter.ts";
import { maskRetainedWorkspace } from "./sharedWorkspaceDispatch.ts";
import { resolveSubscriberWorkshopSession } from "./subscriberWorkshopEntry.ts";

// Count real provider constructions without adding instrumentation to production.
// Node 24's synchronous hooks are newer than the installed Node type definitions.
const counts = globalThis as typeof globalThis & { phaseOneWorkshopBuilds: number };
counts.phaseOneWorkshopBuilds = 0;
const { registerHooks } = nodeModule as typeof nodeModule & { registerHooks(hooks: {
  load(url: string, context: object, next: (url: string, context: object) => object): object;
}): { deregister(): void } };
const hook = registerHooks({ load(url, context, next) {
  if (!url.endsWith("/subscriberCalibrationProvider.ts")) return next(url, context);
  const source = fs.readFileSync(fileURLToPath(url), "utf8");
  const marker = "  const knowledgeRecords = calibrationKnowledgeForRelationship";
  assert.equal(source.split(marker).length, 2);
  return { format: "module", shortCircuit: true, source: ts.transpileModule(source.replace(marker,
    "  globalThis.phaseOneWorkshopBuilds++;\n" + marker), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText };
} });
const { loadSubscriberCalibration, buildSubscriberWorkshop } = await import("./subscriberCalibrationProvider.ts");
const { encodeSubscriberSession, decodeSubscriberSession } = await import("./subscriberCalibrationPersistence.ts");
hook.deregister();

const pagePath = "app/dashboard/vehicles/[id]/calibration/page.tsx";
const routePath = "app/api/calibration-workshop/projection/route.ts";
// Escape the literal App Router brackets rather than matching directories named i or d.
const pagePattern = "app/dashboard/vehicles/[[]id[]]/calibration/page.tsx";
const vercelConfig = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const context = { ownerId: "phase-one-owner", vehicleId: "phase-one-vehicle", sessionId: "a".repeat(32), sourceMode: "subscriber" as const };
const anchors: SubscriberCalibrationSuccess[] = [];
before(async () => {
  // Controlled provider vectors, not physical-car or authenticated browser evidence.
  const b58 = new Uint8Array(7_864_320);
  for (const offset of [262469, 6814977, 7863823]) b58.set(Buffer.from("00003076501103", "hex"), offset);
  const supra = Buffer.alloc(8 * 1024 * 1024, 0xff);
  for (const [offset, marker] of [
    [0x2001a, "#DME_8XT0#C2#HWE#Hardware_DME8XT1_35UP"], [0x2020a, "#DME_86Tx#C2#HWA#DME8.6.T_B58TUE_V1"],
    [0x5fe1e, "#DME_86T0#C2#BTL#MDG1G_35up"], [0x6a0540, "56/1/MG1CS201/11/MG1CS201_BX8TUE"],
    [0x7ffe36, "#DME_86T0__________#C2#DST"],
  ] as const) supra.write(marker, offset, "ascii");
  for (const offset of [524613, 7339265, 8388111]) supra.set(Buffer.from("00005D553C8C05", "hex"), offset);
  supra.set(Buffer.from("00005D553C7805", "hex"), 131371);
  for (const [bytes, fileName] of [[fs.readFileSync("BMW-XDFs-master/N54/IJE0S_MapSwitchBase.bin"), "n54.bin"], [b58, "b58.bin"], [supra, "supra.dtf"]] as const) {
    const result = await loadSubscriberCalibration({ bytes, fileName, mimeType: null, observedAt: "2026-10-09T00:00:00.000Z" });
    if (result.status !== "workshop_ready") assert.fail("Controlled provider anchor unavailable");
    anchors.push(result);
  }
});

// These are configuration guards. Region assignment also requires inspection of
// the real Vercel builder output; Next static analysis alone is not deployment proof.
for (const entry of [pagePath, routePath]) test(`Phase 1: Vercel Sydney target preserves Node/duration for ${entry}`, () => {
  const pattern = entry === pagePath ? pagePattern : routePath;
  assert.equal(path.posix.matchesGlob(entry, pattern), true);
  assert.deepEqual(vercelConfig.functions[pattern], { regions: ["syd1"] });
  const source = ts.createSourceFile(entry, fs.readFileSync(entry, "utf8"), ts.ScriptTarget.Latest, true);
  const config = new Map<string, string>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(item => item.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) config.set(declaration.name.text, declaration.initializer.getText(source));
    }
  }
  assert.equal(config.has("preferredRegion"), false);
  assert.equal(config.get("runtime") ?? '"nodejs"', '"nodejs"');
  assert.equal(config.get("maxDuration"), "60");
  assert.doesNotMatch(source.text, /^["']use client["']/m);
});
test("Phase 1: region scope, existing page dispatch and projection authentication stay bounded", () => {
  assert.deepEqual(vercelConfig, {
    $schema: "https://openapi.vercel.sh/vercel.json",
    functions: { [routePath]: { regions: ["syd1"] }, [pagePattern]: { regions: ["syd1"] } },
  });
  const files = (root: string): string[] => fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = root + "/" + entry.name;
    return entry.isDirectory() ? files(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
  const appFiles = files("app");
  const patterns = Object.keys(vercelConfig.functions);
  const matched = appFiles.filter(file => patterns.some(pattern => path.posix.matchesGlob(file, pattern)));
  assert.deepEqual(matched.sort(), [pagePath, routePath].sort());
  for (const other of ["i", "d", "another-id", "[vehicleId]"]) {
    assert.equal(path.posix.matchesGlob(pagePath.replace("[id]", other), pagePattern), false);
  }
  const regions = appFiles.filter(file => /export const preferredRegion\s*=/.test(fs.readFileSync(file, "utf8")));
  assert.deepEqual(regions, []);
  const page = fs.readFileSync(pagePath, "utf8"), route = fs.readFileSync(routePath, "utf8");
  assert.match(page, /subscriberSuccess \? selectRestoredSubscriberWorkshop\(subscriberSuccess, definition\) : await developmentCalibrationWorkshopProvider\.loadVehicleWorkshop/);
  assert.doesNotMatch(page, /buildSubscriberWorkshop/);
  assert.match(page, /maskRetainedWorkspace\(workshop, subscriberSuccess\)/);
  assert.match(page, /dispatchWorkspace<SharedWorkspacePayload \| null>\(presentation/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /readSession: readSubscriberWorkshopSession/);
  const helper = fs.readFileSync("lib/calibration-workshop/selectRestoredSubscriberWorkshop.ts", "utf8");
  assert.doesNotMatch(helper, /(?:from|import)\s*["'][^"']*(?:test|fixtures)/);
  assert.doesNotMatch(helper, /buildSubscriberWorkshop|buildWorkshopViewModel|buildCurrentOnlyWorkshopViewModel|fetch\(|readSession|Storage|persist/);
});

function parity(result: SubscriberCalibrationSuccess, key?: string) {
  const previous = buildSubscriberWorkshop(result, key), next = selectRestoredSubscriberWorkshop(result, key);
  assert.deepEqual(next, previous);
  for (const field of Object.keys(result.workshop) as (keyof typeof result.workshop)[]) {
    if (field !== "selectedDefinition") assert.equal(next[field], result.workshop[field], field);
  }
  const oldMasked = maskRetainedWorkspace(previous, result), newMasked = maskRetainedWorkspace(next, result);
  assert.deepEqual(newMasked, oldMasked);
  assert.deepEqual(buildSharedWorkspacePayload(newMasked, result, context, key), buildSharedWorkspacePayload(oldMasked, result, context, key));
}
for (const [index, label] of ["N54 comparison", "B58 Gen1 Current-only", "Supra-source DTF Current-only"].entries()) {
  test(`Phase 1: ${label} decoded reuse, exact selection, unavailable/quarantine and initial U0 parity`, () => {
    const bytes = encodeSubscriberSession(context.ownerId, context.vehicleId, 2000, anchors[index]);
    const restored = decodeSubscriberSession(bytes, context.ownerId, context.vehicleId, 1000);
    if (restored?.status !== "workshop_ready") assert.fail("Decode failed");
    parity(restored);
    const definitions = restored.workshop.definitions;
    const keys = new Set([definitions[1].key, definitions.at(-1)!.key,
      ...definitions.filter(item => "available" in item ? !item.available : item.availability !== "current_available").slice(0, 2).map(item => item.key)]);
    for (const key of keys) parity(restored, key);
  });
  test(`Phase 1: ${label} initial session path downloads once and constructs once instead of twice`, async () => {
    const bytes = encodeSubscriberSession(context.ownerId, context.vehicleId, 2000, anchors[index]);
    let reads = 0;
    const read = async () => { reads++; return decodeSubscriberSession(bytes, context.ownerId, context.vehicleId, 1000); };
    const resolve = (requestedSession: string | undefined) => resolveSubscriberWorkshopSession({ requestedSession, ownerId: context.ownerId, vehicleId: context.vehicleId }, {
      readSession: read,
      readLatest: async () => ({ sessionId: context.sessionId, result: (await read())! }),
      recoverVehicle: async () => assert.fail("Unexpected recovery/write"),
    });
    for (const requestedSession of [context.sessionId, undefined]) {
      reads = 0; counts.phaseOneWorkshopBuilds = 0;
      const old = await resolve(requestedSession);
      if (old.result?.status !== "workshop_ready") assert.fail("Decode failed");
      buildSubscriberWorkshop(old.result);
      assert.equal(counts.phaseOneWorkshopBuilds, 2);
      reads = 0; counts.phaseOneWorkshopBuilds = 0;
      const next = await resolve(requestedSession);
      if (next.result?.status !== "workshop_ready") assert.fail("Decode failed");
      selectRestoredSubscriberWorkshop(next.result, next.result.workshop.definitions[1].key);
      assert.equal(reads, 1);
      assert.equal(counts.phaseOneWorkshopBuilds, 1);
    }
    assert.equal(decodeSubscriberSession(bytes, "wrong", context.vehicleId, 1000), null);
    assert.equal(decodeSubscriberSession(bytes, context.ownerId, "wrong", 1000), null);
    assert.equal(decodeSubscriberSession(bytes, context.ownerId, context.vehicleId, 2000), null);
  });
}
test("Phase 1: duplicate revision occurrences select exactly, with no title or ambiguous fallback", () => {
  for (const result of anchors) {
    const material = { ...structuredClone(result.material) };
    material.current = { ...material.current, definitions: [material.current.definitions[0], material.current.definitions[0]] };
    if (material.reference && material.comparison) {
      material.reference = { ...material.reference, definitions: [material.reference.definitions[0], material.reference.definitions[0]] };
      material.comparison = { ...material.comparison, definitions: [material.comparison.definitions[0], material.comparison.definitions[0]] };
    }
    const admitted = { ...result, material, workshop: buildSubscriberWorkshop({ ...result, material }) };
    const second = admitted.workshop.definitions[1];
    assert.equal(second.occurrence, 1);
    parity(admitted, second.key);
    for (const key of ["unknown", "", second.title]) assert.throws(() => selectRestoredSubscriberWorkshop(admitted, key), /unknown or ambiguous/);
    const duplicate = { ...admitted, workshop: { ...admitted.workshop, definitions: [...admitted.workshop.definitions, second] } } as SubscriberCalibrationSuccess;
    assert.throws(() => selectRestoredSubscriberWorkshop(duplicate, second.key), /unknown or ambiguous/);
    const alias = { ...admitted, workshop: { ...admitted.workshop, definitions: [...admitted.workshop.definitions, { ...second, key: "alias" }] } } as SubscriberCalibrationSuccess;
    assert.throws(() => selectRestoredSubscriberWorkshop(alias, second.key), /unknown or ambiguous/);
  }
});
test("Phase 1: selection cannot mutate or freeze any caller-owned evidence, Knowledge or capability object", () => {
  for (const anchor of anchors) {
    const caller = structuredClone(anchor), original = structuredClone(caller);
    const objects: object[] = [];
    const visit = (value: unknown) => { if (value && typeof value === "object") { objects.push(value); for (const child of Object.values(value)) visit(child); } };
    visit(caller);
    selectRestoredSubscriberWorkshop(caller, caller.workshop.definitions[1].key);
    assert.deepEqual(caller, original);
    assert.ok(objects.every(value => !Object.isFrozen(value)));
  }
});
test("Phase 1: retained version-1 sessions use the same default and requested selection", () => {
  for (const anchor of anchors) {
    const result = { ...anchor, workshop: buildSubscriberWorkshop(anchor, anchor.workshop.definitions[1].key) };
    const bytes = serialize({ version: 1, ownerId: context.ownerId, vehicleId: context.vehicleId, expiresAt: 2000, result });
    const restored = decodeSubscriberSession(bytes, context.ownerId, context.vehicleId, 1000);
    if (restored?.status !== "workshop_ready") assert.fail("Decode failed");
    parity(restored);
    parity(restored, restored.workshop.definitions[1].key);
  }
});
