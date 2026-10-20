import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { parseSourceMeasurements } from "./analysisCapabilities.ts";
import type { AnalysisSource } from "./analysisSource.ts";
import type { recoverAnalysisWorkspace as Recover } from "./analysisWorkspace";

// Execute the real TS/TSX tree with only auth, database and source I/O replaced.
// The query boundary exposes reads only: an accidental write is a test failure.
const require = createRequire(import.meta.url);
const ts = require("typescript"), React = require("react"), {renderToStaticMarkup} = require("react-dom/server");
const cache = new Map<string, {exports: unknown}>();
let authorised = true, declaration = "N54b30", selectedSource: AnalysisSource, historicalN54 = false;
const logs = ["first", "second"].map((id, index) => ({id, user_id: "owner", vehicle_id: "vehicle", created_at: `2026-01-0${index + 1}`, log_name: id, authoritative_log_summary_id: null}));
const reads: string[] = [];
function query(table: string) {
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range", "limit", "not", "in"]) q[method] = () => q;
  const historicalRows = logs.map((log, index) => ({
    id: `result-${log.id}`, user_id: "owner", vehicle_id: "vehicle", log_id: log.id,
    maxIat: 30 + index * 30, minRailPressure: 2000 - index * 500,
    cylinderCorrections: {cyl1: -6},
    summary: {engine_v2: {inputQualification: {contract: "qualified-source-v1", platform: "n54"}}},
  }));
  const result = () => ({data: table === "vehicles" ? {id: "vehicle", engine_code: declaration, nickname: "Controlled vehicle"}
    : table === "logs" ? logs.map(log => historicalN54 ? {...log, authoritative_log_summary_id: `result-${log.id}`} : log)
    : table === "log_summaries" && historicalN54 ? historicalRows : [], error: null});
  q.single = async () => result();
  q.maybeSingle = async () => ({data: null, error: null});
  q.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
  return q;
}
function load(file: string): unknown {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file)!.exports;
  const mod = {exports: {} as unknown}; cache.set(file, mod);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {fileName: file, compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
  new Function("require", "module", "exports", compiled)((id: string) => {
    if (id === "server-only") return {};
    if (id === "next/link") return function TestLink({prefetch, ...props}: {prefetch?: boolean}) {void prefetch; return React.createElement("a", props);};
    if (id === "next/navigation") return {redirect: () => {throw Error("signed-out");}, notFound: () => {throw Error("not-found");}};
    if (id.endsWith("subscriberAccess.server")) return {requireSubscriberPage: async () => {if (!authorised) throw Error("signed-out");}};
    if (id === "@/lib/supabase/server") return {createClient: async () => ({auth: {getUser: async () => ({data: {user: {id: "owner"}}})}, from: query})};
    if (id.endsWith("analysisSource.server")) return {readAnalysisSource: async (log: {id: string}) => {reads.push(log.id); return selectedSource;}};
    if (id.endsWith("analysisCalibrationContext.server")) return {readAnalysisCalibration: async (log: {id: string}) => ({state: "unavailable", reason: `Controlled expired Calibration context for ${log.id}.`})};
    const local = id.startsWith("@/") ? path.resolve(id.slice(2)) : id.startsWith(".") ? path.resolve(path.dirname(file), id) : null;
    if (local) {
      const target = [local, local + ".ts", local + ".tsx", path.join(local, "index.ts")].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (target) return load(target);
    }
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}
const {recoverAnalysisWorkspace} = load("lib/analysis/analysisWorkspace.ts") as {recoverAnalysisWorkspace: typeof Recover};
const {default: Page} = load("app/dashboard/vehicles/[id]/analysis/page.tsx") as {default: (props: unknown) => Promise<unknown>};
const headers = "Time,RPM,Boost Mean PSI,Boost target (PSI),Throttle Position (%),Accel Ped. Pos. (%),WGDC Bank 1 (%),IAT (*C),Ethanol Content (Active) (%),Cyl1 Timing Cor (*)";
const csv = headers + "\n" + Array.from({length: 50}, (_, i) => `${i / 10},${3000 + i * 50},24,18,95,100,80,40,10,-5`).join("\n");
const source = (): AnalysisSource => ({state: "available", digest: "synthetic-sha-only", finding: "Original source available.", measurements: parseSourceMeasurements(csv)});
function recover(engineCode = "N54b30", value = source()) {
  return recoverAnalysisWorkspace({log: logs[0], owner: "owner", vehicle: {vehicleId: "vehicle", engineCode}, source: value});
}
async function render(engineCode = "N54b30", log = "first", reprocess?: string): Promise<string> {
  declaration = engineCode; reads.length = 0;
  return renderToStaticMarkup(await Page({params: Promise.resolve({id: "vehicle"}), searchParams: Promise.resolve({log, reprocess})}));
}
test("historical N54 source without a stored qualification runs the established engine in memory", () => {
  const input = source(), before = JSON.stringify(input), result = recover("N54b30", input);
  assert.equal(result.diagnostics, true);
  assert.equal(result.summaryRow?.summary.engine_v2?.inputQualification?.platform, "n54");
  assert(result.summaryRow!.summary.engine_v2!.events.length > 0);
  assert(result.summaryRow!.summary.engine_v2!.crossReferences.length > 0);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(recover("N54b30", input), result);
  assert.match(result.summaryRow!.id, /^in-memory:first:/);
});
test("missing channels remain blocked while other N54 events and graphs survive", () => {
  const result = recover();
  assert(result.summaryRow?.summary.engine_v2?.inputQualification?.missingChannels.includes("lpfp"));
  assert.equal(result.summaryRow?.min_lpfp, null);
  assert((result.telemetry.boost as unknown[]).length > 0);
});
for (const engineCode of ["B58 Gen 1", "B58 Gen 2", "future BMW family"]) test(`${engineCode}: same source measurements, no N54 events or conclusions`, () => {
  const result = recover(engineCode);
  assert.equal(result.diagnostics, false);
  assert.equal(result.summaryRow?.summary.engine_v2, null);
  assert.deepEqual(result.telemetry.boost, source().measurements!.channels.find(channel => channel.key === "boost")!.values);
});
test("wrong owner, wrong vehicle and unavailable source do not qualify or expose measurements", () => {
  for (const changes of [{owner: "other"}, {vehicle: {vehicleId: "other", engineCode: "N54"}}, {source: {...source(), state: "missing" as const}}]) {
    const value = recoverAnalysisWorkspace({log: logs[0], owner: "owner", vehicle: {vehicleId: "vehicle", engineCode: "N54"}, source: source(), ...changes});
    assert.equal(value.summaryRow, null); assert.equal(value.diagnostics, false); assert.deepEqual(value.telemetry, {});
  }
});
test("partial source samples retain [value, null, value] in the full workspace telemetry", () => {
  const input = source(); input.measurements = parseSourceMeasurements("Time,RPM,Boost Mean PSI\n0,1000,1\n1,2000,\n2,3000,3");
  assert.deepEqual(recover("B58 Gen 1", input).telemetry.boost, [1,null,3]);
});
test("explicit unit aliases restore safe measured channels but do not qualify unitless plate or damaged timing", () => {
  const m = parseSourceMeasurements("Time,RPM (rpm),Boost (PSI),Lambda 1 (AFR),Rail pressure mean 1 (PSI),WGDC 1 (%),Throttle Position,(RAM) Ignition Timing Corr. Cyl. 1[\uFFFD]\n0,1000,2,14,2000,50,90,-4");
  for (const key of ["rpm","boost","afr","rail_pressure","wgdc"]) assert(m.channels.some(channel => channel.key === key));
  assert(!m.channels.some(channel => ["throttle","timing_correction_cyl_1"].includes(channel.key)));
});
for (const engineCode of ["N54b30", "B58 Gen 1", "B58 Gen 2"]) test(`${engineCode}: actual page renders full established workspace, compact history and source actions`, async () => {
  selectedSource = source();
  const html = await render(engineCode);
  for (const title of ["Engineering Summary", "Primary Engineering Results", "Intelligent Warnings", "Engineering Inspection Panels", "Engineering Evidence", "Universal XDF", "Calibration Cross Reference", "Per-Cylinder Timing Corrections", "Tune Profile V1", "Tune-Aware Reasoning", "Download original source log", "Related XDF", "Related Calibration Tables", "Cross-Reference Details", "Detected Events", "Root Cause and candidate ranking", "Alternatives and rejected explanations", "Inspection directions", "Event notes", "Cylinder Timing Observation", "Source and data quality", "Missing-channel warnings", "Unit and header warnings", "Measurement-limit observations", "Factual target-versus-actual observations"]) assert(html.includes(title), title);
  assert.match(html, /bmw-border/); assert.match(html, /lg:grid-cols-2/); assert.match(html, /sm:flex-row/);
  assert.match(html, /name="log"/); assert.match(html, /value="first" selected/);
  assert.doesNotMatch(html, /max-h-64/);
  if (engineCode !== "N54b30") assert.match(html, /N54 rules were not applied/);
  else { assert.match(html, /Detected Events/); assert.match(html, /Cross-Reference Details/); assert.match(html, /Evidence and Selection Logic|Supplied Evidence/); }
});
test("explicit log selection and repeated read-only reprocessing retain exact log and original bytes", async () => {
  selectedSource = source(); const before = JSON.stringify(selectedSource);
  const first = await render("N54b30", "second", "1");
  assert.deepEqual(reads, ["second"]); assert.match(first, /Read-only processing:/);
  const again = await render("N54b30", "second", "1");
  assert.deepEqual(reads, ["second"]); assert.equal(first, again);
  assert.equal(JSON.stringify(selectedSource), before);
});
test("missing source leaves the full dashboard and exact recovery action accessible", async () => {
  selectedSource = {state: "missing", measurements: null, digest: null, finding: "The original object for this exact log is missing."};
  const html = await render("N54b30");
  assert.match(html, /Engineering Summary/); assert.match(html, /Recover only the original file for log first/);
  for (const heading of ["Detected Events", "Cross-Reference Details", "Related XDF unavailable", "Cylinder Timing Observation", "Intelligent Warnings"]) assert(html.includes(heading));
});
test("three platforms share the ordered section contract at desktop and stacked breakpoints", async () => {
  selectedSource = source();
  const sections: string[][] = [];
  for (const platform of ["N54b30", "B58 Gen 1", "B58 Gen 2"]) {
    const html = await render(platform);
    sections.push(Array.from(html.matchAll(/data-analysis-section="([^"]+)"/g), m => m[1]));
    assert.match(html, /grid gap-4 md:grid-cols-2/);
    assert.doesNotMatch(html, /(?:hidden|display:none)[^>]*data-analysis-section/);
    assert.match(html, /min-w-0 space-y-2/);
    if (platform !== "N54b30") assert.match(html, /N54 thresholds and causal conclusions are not applied/);
  }
  assert(sections[0].length >= 17);
  assert.deepEqual(sections[0], sections[1]); assert.deepEqual(sections[1], sections[2]);
});
test("selected log updates the Calibration evidence path and unavailable reason", async () => {
  selectedSource = source();
  const html = await render("B58 Gen 1", "second", "1");
  assert.match(html, /selected owned log second/); assert.match(html, /Controlled expired Calibration context for second/);
  assert.doesNotMatch(html, /Controlled expired Calibration context for first/);
});
test("authentication fails before any source read", async () => {
  authorised = false;
  try { await assert.rejects(render(), /signed-out/); assert.deepEqual(reads, []); }
  finally { authorised = true; }
});
test("historical N54 records cannot supply diagnostic trends to a B58 page", async () => {
  historicalN54 = true; selectedSource = source();
  try {
    const html = await render("B58 Gen 1");
    assert.match(html, /N54 rules were not applied/);
    assert.doesNotMatch(html, /historical-comparison|Repeated Correction|Pressure Declining/);
  } finally { historicalN54 = false; }
});
