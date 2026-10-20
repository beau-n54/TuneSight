import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { analysisCapabilities, diagnosticResultQualified, parseSourceMeasurements, selectAnalysisEvidence } from "./analysisCapabilities.ts";
import { readOwnedAnalysisSource, selectMeasurementSource, type AnalysisSource } from "./analysisSource.ts";

const owner = "owner", vehicleId = "vehicle";
const csv = "Time,RPM,Boost Mean PSI,IAT (*C)\n1,1000,0,40\n2,2000,5,41\n3,3000,10,42";
function log(id = "log", authority: string | null = "result") {
  return {id, user_id: owner, vehicle_id: vehicleId, created_at: "2026-01-01", raw_source_storage_path: `${owner}/${vehicleId}/${id}.csv`,
    authoritative_log_summary_id: authority, evidence_source_availability: "unknown", evidence_lifecycle_state: "legacy_unclassified",
    evidence_processing_contract_version: null, evidence_processing_stage: null, evidence_processing_outcome_kind: null,
    evidence_logger_platform: null, evidence_processing_reason_code: null, evidence_retry_disposition: null,
    evidence_diagnostic_reference: null, evidence_processing_started_at: null, evidence_processing_completed_at: null};
}
const result = {id: "result", user_id: owner, vehicle_id: vehicleId, log_id: "log", summary: {engine_v2: {inputQualification: {contract: "qualified-source-v1", platform: "n54"}, events: [{kind: "preserved-qualified-event"}], pullWindows: []}}};
const n54 = {vehicleId, engineCode: "N54"};
const available: AnalysisSource = {state: "available", measurements: parseSourceMeasurements(csv), digest: "fixture-digest", finding: "Your original log remains available and has not been changed."};

// Render the actual server component with only framework Link replaced by an anchor.
const require = createRequire(import.meta.url);
const React = require("react"), {renderToStaticMarkup} = require("react-dom/server"), ts = require("typescript");
const componentPath = "app/dashboard/vehicles/[id]/analysis/SourceMeasurements.tsx";
const compiled = ts.transpileModule(readFileSync(componentPath, "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
const componentModule = {exports: {} as {default: (props: unknown) => unknown}};
new Function("require", "module", "exports", compiled)((id: string) => id === "next/link" ? {default: ({prefetch, ...props}: {prefetch?: boolean}) => { void prefetch; return React.createElement("a", props); }} : id.includes("analysisCapabilities") ? {analysisCapabilities} : require(id), componentModule, componentModule.exports);
const render = (engineCode: string, source: AnalysisSource = available, diagnostics = false) => renderToStaticMarkup(React.createElement(componentModule.exports.default, {vehicleId, vehicle: {vehicleId, engineCode}, logs: [log()], selected: log(), source, diagnostics, priorResultId: "result"}));

test("existing qualified N54 authoritative result and diagnostic payload remain unchanged", async () => {
  const before = JSON.stringify(result);
  const selected = await selectAnalysisEvidence([log()], [result], owner, n54);
  assert.equal(selected.result, result); assert.equal(JSON.stringify(result), before);
  assert.equal(analysisCapabilities("missing", null, n54, true).diagnosticConclusionsAvailable, true);
  assert.doesNotMatch(render("N54", available, true), /conclusions are not yet qualified/);
});
for (const platform of ["B58 Gen 1", "B58 Gen 2", "N55"]) test(`${platform} has owned history, safe measurements and graphs but no N54 conclusions`, async () => {
  assert.equal((await selectAnalysisEvidence([log()], [result], owner, {vehicleId, engineCode: platform})).result, null);
  const html = render(platform);
  assert.match(html, /Open complete owned-log history/); assert.match(html, /Source measurements available/); assert.match(html, /<select/); assert.doesNotMatch(html, /max-h-64|overflow-auto/);
  assert.match(html, /conclusions are not yet qualified/); assert.doesNotMatch(html, /preserved-qualified-event/);
  assert.equal(analysisCapabilities("available", available.measurements, {vehicleId, engineCode: platform}, false).platformSpecificRulesQualified, false);
});
test("older qualified authority wins over newest obsolete result deterministically", async () => {
  const newest = {...log("new", "obsolete"), created_at: "2026-02-01"};
  const obsolete = {...result, id: "obsolete", log_id: "new", summary: {engine_v2: {}}};
  for (const logs of [[newest, log()], [log(), newest]]) assert.equal((await selectAnalysisEvidence(logs, [obsolete, result], owner, n54)).result, result);
  assert.equal((await selectAnalysisEvidence([newest, log()], [obsolete, result], owner, n54, "new")).result, null);
});
test("unpromoted candidate, wrong owner, wrong vehicle and invalid lineage cannot grant diagnostics", async () => {
  for (const changed of [{...result, id: "unpromoted"}, {...result, user_id: "other"}, {...result, vehicle_id: "other"}, {...result, log_id: "other"}]) assert.equal(diagnosticResultQualified(changed, log(), owner, n54), false);
  const invalidLifecycle = {...log(), evidence_lifecycle_state: "invalid"};
  assert.equal((await selectAnalysisEvidence([invalidLifecycle], [result], owner, n54)).result, null);
  assert.equal((await selectAnalysisEvidence([log()], [result], "other", n54)).result, null);
});
test("source parsing and units survive absent platform rules or RPM", () => {
  const parsed = parseSourceMeasurements(csv.replace(/RPM/g, "Unqualified speed"));
  assert(parsed.channels.some(channel => channel.key === "boost")); assert(!parsed.channels.some(channel => channel.key === "rpm"));
  const caps = analysisCapabilities("available", parsed, {vehicleId, engineCode: "N55"}, false);
  assert.equal(caps.sourceParsed, true); assert.equal(caps.unitsQualified, "partial"); assert.equal(caps.platformEvidenceAvailable, false); assert.equal(caps.diagnosticConclusionsAvailable, false);
});
test("ambiguous temperature units exclude only temperature and identify the source header", () => {
  const parsed = parseSourceMeasurements(csv.replace("IAT (*C)", "IAT"));
  assert(!parsed.channels.some(channel => channel.key === "iat")); assert(parsed.channels.some(channel => channel.key === "rpm"));
  assert(parsed.blockers.some(item => item.includes("Temperature unit/alias blocker: source headers IAT")));
  assert.match(render("B58", {...available, measurements: parsed}), /channel\/unit blockers/);
});
test("missing and nonmonotonic time preserve measurements without fabricating graphs", () => {
  for (const raw of [csv.replace("Time", "Clock unknown"), csv.replace("2,2000", "1,2000")]) {
    const parsed = parseSourceMeasurements(raw); assert.equal(parsed.timestamps, null); assert(parsed.channels.length > 0);
    const html = render("B58", {...available, measurements: parsed}); assert.doesNotMatch(html, /<svg/); assert.match(html, /Elapsed-time graphs unavailable/);
  }
});
test("partial observations preserve measured zero and null gaps", () => {
  const parsed = parseSourceMeasurements(csv.replace("2,2000,5,41", "2,2000,,41"));
  assert.deepEqual(parsed.channels.find(item => item.key === "boost")?.values, [0, null, 10]);
  assert.deepEqual(parsed.timestamps, [1, 2, 3]);
});
test("BM3 metadata-only trailer is handled narrowly without accepting arbitrary missing columns", () => {
  const raw = "Time,RPM,Boost Mean PSI,bootmod3_3.17.012_unknown,6a1f07eea3dca97ed5b936e3\n0,1000,1,0\n1,2000,2,0";
  const parsed = parseSourceMeasurements(raw); assert.deepEqual(parsed.channels[0].values, [1000, 2000]);
  assert.throws(() => parseSourceMeasurements(raw.replace("bootmod3_3.17.012_unknown", "unknown")));
  assert.throws(() => parseSourceMeasurements(raw.replace("1,2000,2,0", "1,2000")));
});
test("unsupported format fails closed without deriving identity", () => {
  const unsupported = parseSourceMeasurements("Time,RPM,Unknown pressure\n0,1000,10");
  assert.equal(unsupported.channels.length, 0);
  assert.equal(analysisCapabilities("available", unsupported, n54, false).sourceParsed, true);
  assert.equal(analysisCapabilities("available", unsupported, n54, false).unitsQualified, "unavailable");
  assert.equal(analysisCapabilities("available", available.measurements, n54, false).platformEvidenceAvailable, false);
  assert.match(render("N54"), /Saved labels are owner declarations/);
});
test("owned reprocessing is repeatable and cannot write or create duplicate records", async () => {
  const paths: string[] = [];
  const download = async (path: string) => {paths.push(path); return {data: new Blob([csv]), error: null};};
  const before = JSON.stringify(log());
  const a = await readOwnedAnalysisSource(log(), owner, vehicleId, "https://project.invalid", download);
  const b = await readOwnedAnalysisSource(log(), owner, vehicleId, "https://project.invalid", download);
  assert.deepEqual(a, b); assert.equal(JSON.stringify(log()), before); assert.equal(paths.length, 2); assert.equal(a.state, "available");
  assert.match(render("B58", a), /Reprocess existing owned source/); assert.doesNotMatch(render("B58", a), /Recover only the original file/);
});
test("missing objects differ from denied, timed-out and unverified requests", async () => {
  for (const [error, expected] of [[{statusCode: 404}, "missing"], [{code: "NoSuchKey"}, "missing"], [{statusCode: 403}, "temporarily_unavailable"], [{statusCode: 500}, "temporarily_unavailable"]] as const) {
    const source = await readOwnedAnalysisSource(log(), owner, vehicleId, "https://project.invalid", async () => ({data: null, error}));
    assert.equal(source.state, expected);
    if (expected === "missing") assert.match(render("B58", source), /Recover only the original file for log/);
    else assert.doesNotMatch(render("B58", source), /Recover only the original file/);
  }
});
test("cross-owner, cross-vehicle and spoofed storage paths cannot reach storage", async () => {
  let calls = 0; const download = async () => {calls++; return {data: new Blob([csv]), error: null};};
  for (const candidate of [{...log(), user_id: "other"}, {...log(), vehicle_id: "other"}, {...log(), raw_source_storage_path: "other/vehicle/log.csv"}, {...log(), raw_source_storage_path: null, file_url: "https://evil.invalid/storage/v1/object/sign/logs/owner/vehicle/log.csv"}]) {
    assert.equal((await readOwnedAnalysisSource(candidate, owner, vehicleId, "https://project.invalid", download)).state, "unresolved");
  }
  assert.equal(calls, 0);
});
test("legacy signed URL is resolved only to exact owned project storage, never fetched", async () => {
  let path = "";
  const source = await readOwnedAnalysisSource({...log(), raw_source_storage_path: null, file_url: "https://project.invalid/storage/v1/object/sign/logs/owner/vehicle/log.csv?token=expired"}, owner, vehicleId, "https://project.invalid", async value => {path = value; return {data: new Blob([csv]), error: null};});
  assert.equal(path, "owner/vehicle/log.csv"); assert.equal(source.state, "available");
});
test("invalid source retains source capability and dashboard history", async () => {
  const source = await readOwnedAnalysisSource(log(), owner, vehicleId, "https://project.invalid", async () => ({data: new Blob([new Uint8Array([255])]), error: null}));
  assert.equal(source.state, "available"); assert.equal(source.measurements, null);
  assert.match(render("B58", source), /Open complete owned-log history/); assert.match(render("B58", source), /No re-upload is needed/);
});
test("measurement fallback skips unusable newest source, explicit selection does not", async () => {
  const newest = {...log("new"), created_at: "2026-02-01"};
  const read = async (item: ReturnType<typeof log>) => item.id === "new" ? {...available, measurements: null} : available;
  assert.equal((await selectMeasurementSource([newest, log()], owner, vehicleId, item => read(item as ReturnType<typeof log>)))?.log.id, "log");
  assert.equal((await selectMeasurementSource([newest, log()], owner, vehicleId, item => read(item as ReturnType<typeof log>), "new"))?.log.id, "new");
});
test("route keeps unavailable-result dashboard, authenticated ownership and original diagnostic branch", () => {
  const route = readFileSync("app/dashboard/vehicles/[id]/analysis/page.tsx", "utf8");
  assert.match(route, /await requireSubscriberPage/); assert.doesNotMatch(route, /if \(!selection.result\)/);
  assert.match(route, /recoverAnalysisWorkspace/); assert.match(route, /EngineeringWorkspaceShell/);
  assert.doesNotMatch(route, /Upload the original source again/);
  assert.doesNotMatch(readFileSync("lib/analysis/analysisSource.server.ts", "utf8"), /\.(insert|update|upsert|delete|upload|remove)\(/);
});
