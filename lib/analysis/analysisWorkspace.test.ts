import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { parseSourceMeasurements } from "./analysisCapabilities.ts";
import type { AnalysisSource } from "./analysisSource.ts";
import type { recoverAnalysisWorkspace as Recover } from "./analysisWorkspace";
import type {AnalysisCalibrationContext} from "./analysisCalibrationContext";

// Execute the real TS/TSX tree with only auth, database and source I/O replaced.
// The query boundary exposes reads only: an accidental write is a test failure.
const masterCensus = JSON.parse(fs.readFileSync("engineering/calibration/bmw-master-99-xdf-census.json", "utf8")) as {rows: {family: string}[]};
const masterFamilies = [...new Set(masterCensus.rows.map(row => row.family))];

test("canonical findings have unique occurrences; references and chart links preserve exact source rows", async()=>{
  selectedSource=source();
  const before=JSON.stringify(selectedSource),html=await render("B58 Gen 1");
  const events=(load("lib/analysis/sourceObservationEvents.ts") as typeof import("./sourceObservationEvents")).sourceObservationEvents(selectedSource).events;
  for(const event of events){
    assert.equal(html.split(`data-finding-id="${event.id}"`).length-1,1);
    assert(html.includes(`href="#analysis-interval-${event.startRow}-${event.endRow}"`));
    assert(html.includes(`href="#occurrence-${event.id}"`));
  }
  assert.equal(JSON.stringify(selectedSource),before);
  assert.match(html,/Copy exact evidence/);
  assert.match(html,/Owner-declared context/);
  assert.match(html,/No whole-log peak is promoted/);
  const primaryIds=["engineering-summary","primary-engineering-results","engineering-telemetry","engineering-evidence","engineering-investigation","calibration-context"];
  const positions=primaryIds.map(id=>html.indexOf(`id="${id}"`));
  assert(positions.every((v,i)=>v>=0&&(!i||v>positions[i-1])));
  assert.doesNotMatch(html,/Create Next App/);
});
const require = createRequire(import.meta.url);
const ts = require("typescript"), React = require("react"), {renderToStaticMarkup} = require("react-dom/server");
const cache = new Map<string, {exports: unknown}>();
let authorised = true, declaration = "N54b30", selectedSource: AnalysisSource, historicalN54 = false;
let admittedContext: AnalysisCalibrationContext | null = null;
let delayedCalibration: Promise<AnalysisCalibrationContext> | null = null;
let calibrationReads = 0;
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
    if (id.endsWith("analysisCalibrationContext.server")) return {readAnalysisCalibration: async (log: {id: string}) => { calibrationReads++; return delayedCalibration ?? admittedContext ?? ({state: "unavailable", reason: `Controlled expired Calibration context for ${log.id}.`}); }};
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
// Resolve async server children for controlled markup tests; browser streaming is checked separately.
async function resolveServerTree(value: unknown): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map(resolveServerTree));
  if (!React.isValidElement(value)) return value;
  const element = value as {type: unknown; props: Record<string, unknown>};
  if (typeof element.type === "function" && element.type.constructor.name === "AsyncFunction")
    return resolveServerTree(await element.type(element.props));
  const props = Object.fromEntries(await Promise.all(Object.entries(element.props).map(async ([key, child]) => [key, await resolveServerTree(child)])));
  return React.cloneElement(value, props);
}
async function render(engineCode = "N54b30", log = "first", reprocess?: string): Promise<string> {
  declaration = engineCode; reads.length = 0;
  return renderToStaticMarkup(await resolveServerTree(await Page({params: Promise.resolve({id: "vehicle"}), searchParams: Promise.resolve({log, reprocess})})));
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
  for (const title of ["Engineering Summary", "Contextual findings", "Intelligent Warnings", "Engineering Inspection Panels", "Engineering Evidence", "Universal XDF", "Calibration Cross Reference", "Per-Cylinder Timing Corrections", "Tune Profile V1", "Tune-Aware Reasoning", "Download original source log", "Related XDF", "Related Calibration Tables", "Cross-Reference Details", "Detected Events", "Evidence-supported investigation candidates", "Alternatives and rejected explanations", "Inspection directions", "Event notes", "Cylinder Timing Observation", "Source and data quality", "Missing or unusable channels", "Measured operating ranges", "Factual target-versus-actual observations"]) assert(html.includes(title), title);
  assert.match(html, /bmw-border/); assert.match(html, /lg:grid-cols-2/); assert.match(html, /sm:flex-row/);
  assert.match(html, /name="log"/); assert.match(html, /value="first" selected/);
  assert.doesNotMatch(html, /max-h-64/);
  if (engineCode !== "N54b30") assert.doesNotMatch(html, /N54/);
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
  assert.match(html, /Source inspection unavailable/); assert.match(html, /Recover only the original file for log first/);
  for (const heading of ["Detected Events", "Cross-Reference Details", "Tune Profile V1"]) assert(html.includes(heading));
});
test("three platforms share the ordered section contract at desktop and stacked breakpoints", async () => {
  selectedSource = source();
  const sections: string[][] = [];
  for (const platform of ["N54b30", "B58 Gen 1", "B58 Gen 2"]) {
    const html = await render(platform);
    sections.push(Array.from(html.matchAll(/data-analysis-section="([^"]+)"/g), m => m[1]));
    assert.match(html, /grid items-start gap-4 md:grid-cols-2/);
    assert.doesNotMatch(html, /(?:hidden|display:none)[^>]*data-analysis-section/);
    assert.match(html, /min-w-0 space-y-3/);
    if (platform !== "N54b30" && platform !== "N54") assert.doesNotMatch(html, /N54/);
  }
  assert(sections[0].length >= 15);
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
    assert.doesNotMatch(html, /N54/);
    assert.doesNotMatch(html, /historical-comparison|Repeated Correction|Pressure Declining/);
  } finally { historicalN54 = false; }
});

for (const [platform, software, bytes] of [["N54b30", "I8A0S", 2097152], ["B58 Gen 1", "00003076501103", 7864320], ["B58 Gen 2", "00005D553C8C05", 8388608], ...masterFamilies.map(family => [family, "synthetic-owned-ROM", 16] as const)] as const) test(`${platform}: response-only exact Definitions render in all three Calibration sections`, async () => {
  selectedSource = source();
  admittedContext = {state: "available", owner: "owner", vehicle: "vehicle", sessionId: null, sourceId: "owned-tune", resolutionPath: "Fresh response-only admission", result: {
    status: "workshop_ready", identity: software, digest: "synthetic-digest", byteLength: bytes, container: "bin",
    material: {reference: null, comparison: null, current: {sourceRole: "user_modified", provenance: ["Synthetic fixture"], contractVersion: "tunesight.qualified-calibration-dataset.v1", datasetId: "dataset", datasetRevision: "dataset-revision", definitionSetRevisionId: "set", sourceArtifactDigest: "artifact",
      exactBinaryIdentity: {softwareIdentity: software, digest: "synthetic-digest", byteLength: bytes, romFamily: "Synthetic"},
      definitions: [{definitionRevisionId: "exact-revision", title: "Exact admitted synthetic table", state: "qualified_engineering_value", sourceArtifactDigest: "artifact"}]}},
    workshop: {source: {currentDatasetId: "dataset", currentDatasetRevision: "dataset-revision", definitionSetRevision: "set"}, definitions: [{key: "key", definitionRevision: "exact-revision", occurrence: 0, availability: "current_available", semantic: {outcome: "exact", telemetryRelationships: [{value: {channelId: "boost", meaning: "Controlled inspection relationship"}, assertionId: "assertion", assertionRevision: "1", provenance: ["Synthetic"], limitations: ["No diagnostic authority"]}]}}]},
  }} as unknown as AnalysisCalibrationContext;
  try {
    const html = await render(platform);
    assert.match(html, /Fresh response-only admission/);
    assert.match(html, /evidence-supported inspection relationships available/);
    assert.equal((html.match(/Exact admitted synthetic table/g) ?? []).length, 2);
    assert.equal((html.match(/data-primary-table=/g) ?? []).length, 1);
    assert.equal((html.match(/data-inspection-table="exact-revision"/g) ?? []).length, 1);
    assert.match(html, /1 maps/);
    assert.match(html, /Source-derived Evidence Score \/ Investigation Priority/);
    assert.match(html, /Points, reductions and source intervals/);
    assert.match(html, /Relationship adds 0 points/);
    assert.match(html, /Platform-qualified diagnostic cross-references/);
    assert.match(html, /Direct table relationship/);
    assert.match(html, /Occurrence 0; exact-revision/);
    assert.doesNotMatch(html, /href="null|calibration\?session=/);
    assert.match(html, /Telemetry available; no qualified Calibration-table binding has been established/);
    if (platform !== "N54b30" && platform !== "N54") assert.doesNotMatch(html, /N54/);
    if (admittedContext.state === "available") { const r=admittedContext.result; admittedContext={...admittedContext,result:{...r,material:{...r.material,current:{...r.material.current,exactBinaryIdentity:{...r.material.current.exactBinaryIdentity,softwareIdentity:"mismatched-source"}}}}}; }
    const rejected = await render(platform);
    assert.doesNotMatch(rejected, /data-primary-table=/);
    assert.match(rejected, /Calibration bindings not evaluated/);
  } finally { admittedContext = null; }
});


for (const platform of [...masterFamilies, "N20", "N55", "S55", "N13", "future BMW family"]) test(`${platform}: complete master-platform page contains events, reasoning and item-level blockers`, async () => {
  selectedSource = source();
  const html = await render(platform);
  for (const title of ["Engineering Summary", "Contextual findings", "Intelligent Warnings", "Detected Events", "Tune-Aware Reasoning", "Calibration Cross Reference", "Related XDF", "Related Calibration Tables", "Exact source evidence and unresolved alternatives", "No whole-log peak", "Contextual findings", "Event observations and individual blockers"]) assert(html.includes(title), title);
  assert.match(html, /Largest same-row difference/);
  assert.match(html, /Source-derived Evidence Score \/ Investigation Priority/);
  assert.match(html, /No qualified Calibration-table relationship is available for this event/);
  assert.match(html, /Diagnostic confidence is retained separately/);
  assert.match(html, /Measured rail-pressure decline.*additional evidence needed/);
  assert.match(html, /distinct occurrence\(s\)/);
  assert.match(html, /lg:grid-cols-2/); assert.match(html, /sm:grid-cols-2/); assert.match(html, /bmw-border/);
  if (platform !== "N54") assert.doesNotMatch(html, /N54|n54/);
  if (!platform.toLowerCase().startsWith("b58")) assert.doesNotMatch(html, /B58|b58/);
  assert.doesNotMatch(html, /undefined|NaN/);
  for (const title of ["Pull and operating windows", "source-derived event notes", "Tune evidence and declared operating context", "Declare operating tune context for this page only"]) assert(html.includes(title), title);
  assert.doesNotMatch(html, /Unavailable: source measurements alone|Unavailable: no qualified causal assessment|No qualified diagnostic event notes are available/);
  assert.match(html, /measured high-demand acceleration window/);
  if (platform !== "N54") assert.match(html, /source-acceleration-0/);
});

for (const platform of [...masterFamilies, "N20"]) test(`${platform}: Calibration Context keeps logged RPM, IAT and HPFP available without table authority`, async () => {
  selectedSource = {...source(), measurements: parseSourceMeasurements("Time,RPM,Boost Mean PSI,IAT (*C),Rail pressure (PSI)\n0,1000,2,30,2000\n1,2000,3,31,1900")};
  const html = await render(platform);
  for (const key of ["rpm", "iat", "rail_pressure"]) {
    assert.match(html, new RegExp(`data-telemetry-channel="${key}" data-telemetry-state="available"`));
    assert.doesNotMatch(html, new RegExp(`${key}: Not present`));
  }
  for (const title of ["Observed Telemetry", "System Association", "Unavailable Bindings", "Related XDF", "Related Calibration Tables"]) assert(html.includes(title));
  assert.match(html, /Calibration bindings not evaluated/);
});

test("qualified existing check with no event reaches the UI, separately from detection", async () => {
 selectedSource=source(); const html=await render("N54b30");
 assert.match(html,/Qualified check evaluated; no event detected/);
 assert.match(html,/heat_soak/);
 const checks=recover().summaryRow?.summary.engine_v2?.diagnosticChecks;
 assert.equal(checks?.find(c=>c.id==="heat_soak")?.state,"evaluated_no_event");
});

test("telemetry server tree does not await supplementary Calibration; one read supplies both surfaces", async () => {
 selectedSource=source(); declaration="B58 Gen 1"; calibrationReads=0;
 let finish!: (value: AnalysisCalibrationContext)=>void;
 delayedCalibration=new Promise(resolve=>{finish=resolve});
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  const tree=await Promise.race([Page({params:Promise.resolve({id:"vehicle"}),searchParams:Promise.resolve({log:"first"})}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("Telemetry blocked on Calibration")),500)})]);
  assert(tree); assert.equal(calibrationReads,1);
  finish({state:"unavailable",reason:"Synthetic retrieval timeout"});
  const html=renderToStaticMarkup(await resolveServerTree(tree));
  assert.match(html,/Calibration bindings not evaluated: Synthetic retrieval timeout/);
  assert.match(html,/50 source samples/);assert.equal(calibrationReads,1);
 } finally {if(timer)clearTimeout(timer); finish({state:"unavailable",reason:"Synthetic end"}); delayedCalibration=null;}
});
