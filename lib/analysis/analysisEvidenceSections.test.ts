import test from "node:test";
import assert from "node:assert/strict";
import { serialize } from "node:v8";
import { analysisEvidenceSections } from "./analysisEvidenceSections.ts";
import { resolveAnalysisCalibration, type AnalysisCalibrationContext } from "./analysisCalibrationContext.ts";
import { readAnalysisCalibrationContext } from "./analysisCalibrationRead.ts";
import { parseSourceMeasurements } from "./analysisCapabilities.ts";
import type { AnalysisSource } from "./analysisSource.ts";
import { resolveDurableAnalysisContext } from "./analysisDurableContext.ts";
import { definitionInspectionRelationships } from "./analysisDefinitionRelationships.ts";

const log = {id: "selected", user_id: "owner", vehicle_id: "vehicle", created_at: "2026-01-01"};
const source = (csv: string): AnalysisSource => ({state: "available", digest: "controlled-source", finding: "Owned source available.", measurements: parseSourceMeasurements(csv)});
const csv = "Time,RPM,Boost Mean PSI,Boost target (PSI),Cyl1 Timing Cor (*)\n0,1000,3,2,-1\n1,2000,,4,-2\n2,3000,8,6,";

// Explicitly synthetic owner output: tests resolution, not real BMW qualification.
function context(software = "00003076501103", bytes = 7864320): Extract<AnalysisCalibrationContext, {state: "available"}> {
  const definition = {definitionRevisionId: "revision", title: "Synthetic exact table", state: "qualified_engineering_value", sourceArtifactDigest: "artifact"};
  return {state: "available", owner: "owner", vehicle: "vehicle", sessionId: "a".repeat(32), result: {
    status: "workshop_ready", identity: software, digest: "owned-digest", byteLength: bytes, container: software === "00005D553C8C05" ? "dtf" : "bin",
    material: {reference: null, comparison: null, current: {sourceRole: "user_modified", provenance: ["Synthetic fixture"], contractVersion: "tunesight.qualified-calibration-dataset.v1", datasetId: "dataset", datasetRevision: "dataset-revision",
      definitionSetRevisionId: "set", sourceArtifactDigest: "artifact", definitions: [definition],
      exactBinaryIdentity: {softwareIdentity: software, digest: "owned-digest", byteLength: bytes, romFamily: "Synthetic source family"}}},
    workshop: {source: {currentDatasetId: "dataset", currentDatasetRevision: "dataset-revision", definitionSetRevision: "set"},
      definitions: [{key: "exact-occurrence", definitionRevision: "revision", occurrence: 0, availability: "current_available",
        semantic: {outcome: "exact", telemetryRelationships: [{value: {channelId: "boost", meaning: "Synthetic qualified telemetry relationship"},
          assertionId: "assertion", assertionRevision: "assertion-revision", provenance: ["Synthetic controlled evidence"], limitations: ["Not production qualification"]}]}}]},
  } as unknown as Extract<AnalysisCalibrationContext, {state: "available"}>["result"]};
}
const resolve = (c = context(), channels = ["boost"]) => resolveAnalysisCalibration(c, log, "owner", "vehicle", channels);
test("source facts and warnings do not depend on diagnostic qualification", () => {
  const facts = analysisEvidenceSections(source(csv));
  assert.equal(facts.ranges.find(r => r.channel === "boost")?.count, 2);
  assert(facts.missing.some(s => s.includes("lpfp")));
  assert(facts.systems.some(s => s.channels.includes("boost")));
  assert.equal("diagnosis" in facts, false);
});
test("target differences use matching finite rows, not unrelated independent peaks", () => {
  assert.deepEqual(analysisEvidenceSections(source(csv)).targetDifference, {count: 2, unit: "psi", minimum: 1, maximum: 2});
});
test("missing target does not invent an error or threshold", () => {
  assert.equal(analysisEvidenceSections(source("Time,RPM,Boost Mean PSI\n0,1000,2")).targetDifference, null);
});
test("cylinder observations preserve gaps and do not classify knock", () => {
  const t = analysisEvidenceSections(source(csv)).timing;
  assert.equal(t.length, 1); assert.equal(t[0].count, 2); assert.equal(t[0].missing, 1);
});
test("unavailable sources cannot leak retained measurements", () => {
  assert.equal(analysisEvidenceSections({...source(csv), state: "missing"}).ranges.length, 0);
});
test("damaged Supra timing headers remain unavailable with explicit blockers", () => {
  const f = analysisEvidenceSections(source("Time,RPM (rpm),Boost (PSI),(RAM) Ignition Timing Corr. Cyl. 1[\uFFFD]\n0,1000,3,-5"));
  assert.equal(f.timing.length, 0); assert(f.blockers.some(b => b.includes("timing_correction_cyl_1")));
});
for (const [name, software, bytes] of [["B58", "00003076501103", 7864320], ["Supra", "00005D553C8C05", 8388608]] as const) {
  test(`${name} exact vehicle context resolves without embedded log Definition evidence or N54 rules`, () => {
    const c = context(software, bytes), before = JSON.stringify(c);
    const result = resolve(c);
    assert.equal(result.relationships.length, 1); assert.equal(result.identity?.bytes, bytes);
    assert.equal(result.identity?.software, software); assert.match(result.relationships[0].grade, /Exact Definition/);
    assert.match(result.href!, /session=/); assert.equal(JSON.stringify(c), before);
  });
}
test("wrong ROM is rejected", () => {
  const c = context(); c.result = {...c.result, identity: "wrong"};
  assert.match(resolve(c).reason!, /ROM/); assert.equal(resolve(c).identity, null);
});
test("library source size cannot replace the owned source size", () => {
  const c = context(); c.result = {...c.result, byteLength: 7864576};
  assert.equal(resolve(c).relationships.length, 0);
});
test("wrong Dataset revision is rejected", () => {
  const c = context(); c.result = {...c.result, workshop: {...c.result.workshop, source: {...c.result.workshop.source, currentDatasetRevision: "wrong"}}} as typeof c.result;
  assert.equal(resolve(c).identity, null);
});
test("wrong Definition Set is rejected", () => {
  const c = context(); c.result = {...c.result, workshop: {...c.result.workshop, source: {...c.result.workshop.source, definitionSetRevision: "wrong"}}} as typeof c.result;
  assert.equal(resolve(c).identity, null);
});
test("duplicate occurrence cannot create a relationship", () => {
  const c = context(); c.result = {...c.result, workshop: {...c.result.workshop, definitions: [...c.result.workshop.definitions, ...c.result.workshop.definitions]}} as typeof c.result;
  assert.equal(resolve(c).relationships.length, 0);
});
test("a table title or missing telemetry binding cannot create a relationship", () => {
  const c = context();
  c.result = {...c.result, workshop: {...c.result.workshop, definitions: c.result.workshop.definitions.map(d => ({...d, title: "Boost Target WGDC", semantic: {...d.semantic, telemetryRelationships: []}}))}} as typeof c.result;
  assert.equal(resolve(c).relationships.length, 0); assert.match(resolve(c).reason!, /qualified telemetry relationship/);
});
test("selected source channels are required even when exact Definition exists", () => {
  assert.equal(resolve(context(), ["lpfp"]).relationships.length, 0);
});
test("owner and vehicle mismatch cannot expose Calibration identity", () => {
  for (const c of [{...context(), owner: "other"}, {...context(), vehicle: "other"}]) assert.equal(resolve(c).identity, null);
  assert.equal(resolveAnalysisCalibration(context(), {...log, user_id: "other"}, "owner", "vehicle", ["boost"]).identity, null);
});
test("missing Calibration evidence preserves exact unavailable reason", () => {
  assert.equal(resolveAnalysisCalibration({state: "unavailable", reason: "Expired exact session."}, log, "owner", "vehicle", ["boost"]).reason, "Expired exact session.");
});
test("read-only boundary rejects a foreign log before reading storage", async () => {
  let reads = 0;
  const result = await readAnalysisCalibrationContext({...log, user_id: "other"}, "owner", "vehicle", "secret", async () => {reads++; throw Error("must not read");});
  assert.equal(result.state, "unavailable"); assert.equal(reads, 0);
});
for (const state of ["available", "expired", "scope_mismatch", "corrupt"] as const) test(`download-only session boundary: ${state}`, async () => {
  const c = context();
  const bytes = state === "corrupt" ? new Uint8Array([1,2,3]) : serialize({
    version: 1, ownerId: state === "scope_mismatch" ? "foreign" : "owner", vehicleId: "vehicle",
    expiresAt: state === "expired" ? 1 : Date.now() + 60000, result: c.result,
  });
  const calls: string[] = [];
  const result = await readAnalysisCalibrationContext(log, "owner", "vehicle", "secret", async p => {
    calls.push(p); return {data: new Blob([p.startsWith("session-active/") ? c.sessionId! : bytes]), error: null};
  });
  assert.equal(result.state, state === "available" ? "available" : "unavailable");
  assert.equal(calls.length, 2); assert.equal(calls[1], `sessions/${c.sessionId}`);
  if (state === "expired" && result.state === "unavailable") assert.match(result.reason, /expired/);
});
test("malformed pointer and transient errors never leak private errors or attempt writes", async () => {
  for (const download of [async () => ({data: new Blob(["../escape"]), error: null}), async () => {throw Error("SECRET details");}]) {
    const result = await readAnalysisCalibrationContext(log, "owner", "vehicle", "secret", download);
    assert.equal(result.state, "unavailable"); assert.doesNotMatch(JSON.stringify(result), /SECRET|escape/);
  }
});
test("valid current context is reused only after durable identity and admission agree", async () => {
  const current = context(), before = JSON.stringify(current), calls: string[] = [];
  const result = await resolveDurableAnalysisContext(log, "owner", "vehicle",
    async () => {calls.push("session"); return current;},
    async () => {calls.push("durable"); return {...context(), sessionId: null, sourceId: "owned-tune"};});
  assert.equal(result.state, "available");
  if (result.state === "available") assert.equal(result.sessionId, current.sessionId);
  assert.deepEqual(calls, ["session", "durable"]); assert.equal(JSON.stringify(current), before);
});
for (const state of ["expired", "absent", "stale"] as const) test(`${state} session produces response-only durable context without renewing or replacing`, async () => {
  const old: AnalysisCalibrationContext = state === "stale" ? {...context(), result: {...context().result, digest: "wrong"}} : {state: "unavailable", reason: state};
  const before = JSON.stringify(old);
  const result = await resolveDurableAnalysisContext(log, "owner", "vehicle", async () => old,
    async () => ({...context(), sessionId: null, sourceId: "owned-tune", resolutionPath: "Fresh provider admission."}));
  assert.equal(result.state, "available");
  if (result.state === "available") {assert.equal(result.sessionId, null); assert.equal(result.sourceId, "owned-tune");}
  assert.match(result.resolutionPath!, /No session created, renewed or replaced/);
  assert.equal(JSON.stringify(old), before);
});
test("reconstruction cannot bypass owner/vehicle scope or inconsistent Dataset binding", async () => {
  for (const foreign of [{...log, user_id: "other"}, {...log, vehicle_id: "other"}]) {
    const result = await resolveDurableAnalysisContext(foreign, "owner", "vehicle", async () => assert.fail("session read"), async () => assert.fail("durable read"));
    assert.equal(result.state, "unavailable");
  }
  const wrong = context(); wrong.result = {...wrong.result, workshop: {...wrong.result.workshop, source: {...wrong.result.workshop.source, currentDatasetRevision: "wrong"}}} as typeof wrong.result;
  assert.equal((await resolveDurableAnalysisContext(log, "owner", "vehicle", async () => context(), async () => wrong)).state, "unavailable");
});
test("expired source hash is a locator only, never an expired Dataset", async () => {
  const old = context(); old.result = {...old.result, digest: "a".repeat(64)};
  const bytes = serialize({version: 1, ownerId: "owner", vehicleId: "vehicle", expiresAt: 1, result: old.result});
  const before = Buffer.from(bytes);
  const result = await readAnalysisCalibrationContext(log, "owner", "vehicle", "secret", async p => ({data: new Blob([p.startsWith("session-active/") ? old.sessionId! : bytes]), error: null}));
  assert.equal(result.state, "unavailable"); assert.equal(result.locator?.digest, "a".repeat(64));
  assert.equal("result" in result, false); assert.deepEqual(bytes, before);
});
test("source-described inspection requires an exact clause and qualified unit, not title similarity", () => {
  const c = context(), d = c.result.material.current.definitions[0], semantic = c.result.workshop.definitions[0].semantic;
  const unavailable = {...semantic, outcome: "unavailable" as const, telemetryRelationships: []};
  assert.equal(definitionInspectionRelationships({...d, title: "Boost Ceiling"}, unavailable, ["boost"]).length, 0);
  const described = {...d, description: "This ceiling is applied to the intake manifold boost target.", units: "psi (relative)"};
  const related = definitionInspectionRelationships(described, unavailable, ["boost"]);
  assert.equal(related.length, 1); assert.match(related[0].grade, /not independently validated/);
  assert.equal(definitionInspectionRelationships({...described, units: "unknown"}, unavailable, ["boost"]).length, 0);
  assert.equal(definitionInspectionRelationships(described, unavailable, ["lpfp"]).length, 0);
});
test("qualified system membership supplies inspection context without diagnostic thresholds", () => {
  const c = context(), d = c.result.material.current.definitions[0], semantic = c.result.workshop.definitions[0].semantic;
  const binding = {...semantic, telemetryRelationships: [], relatedCalibrations: [], limitations: [],
    engineeringSystem: {value: "Boost & Air Control", assertionId: "system", assertionRevision: "1", authority: "controlled", provenance: ["synthetic"], limitations: []}};
  const related = definitionInspectionRelationships(d, binding, ["boost"]);
  assert.equal(related.length, 1); assert.match(related[0].meaning, /does not establish direct control or causation/);
  assert.equal(definitionInspectionRelationships(d, {...binding, outcome: "partial"}, ["boost"]).length, 0);
});
