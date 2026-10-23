import test from "node:test";
import assert from "node:assert/strict";
import { parseSourceMeasurements } from "./analysisCapabilities.ts";
import { analysisChannelStatus } from "./analysisChannelStatus.ts";
import type { AnalysisSource } from "./analysisSource";
import type { AnalysisCalibrationResolution } from "./analysisCalibrationContext";

const unavailable: AnalysisCalibrationResolution = {identity: null, relationships: [], reason: "No admitted table authority", withheld: [], href: null, resolutionPath: null, sourceId: null};
const source = (headers: string, row: string): AnalysisSource => ({state: "available", digest: "synthetic", finding: "Owned source",
  measurements: parseSourceMeasurements(`Time,Boost Mean PSI,${headers}\n0,1,${row}\n1,2,${row}`)});
for (const [rpm, iat, rail] of [
  ["RPM","IAT (*C)","Rail pressure (PSI)"], ["RPM (rpm)","IAT[F]","Rail pressure mean 1 (PSI)"],
  ["Engine speed[1/min]","Intake Air Temperature (F)","HPFP Act.[psig]"],
  ["Engine Speed","IAT[C]","rail_pressure_psi"],
]) test(`authorised MHD aliases retain independent sample status: ${rpm}, ${iat}, ${rail}`, () => {
  const s = source(`${rpm},${iat},${rail}`, "1200,86,2000"), before = JSON.stringify(s);
  const status = analysisChannelStatus(s, unavailable);
  for (const key of ["rpm","iat","rail_pressure"]) {
    const c = status.channels.find(c => c.key === key)!;
    assert.equal(c.raw, "present"); assert.equal(c.alias, "qualified"); assert.equal(c.samples.count, 2);
    assert(c.system); assert.equal(c.bindings.length, 0); assert.equal(c.diagnosticRelationship, "not_established");
    assert.equal(c.bindingState, "not_evaluated"); assert.match(c.bindingMessage, /evaluation could not complete/);
  }
  assert.equal(new Set(status.channels.map(c => c.key)).size, status.channels.length);
  assert.equal(JSON.stringify(s), before);
});
test("BM3 names use only its exact translator contract", () => {
  const s = {...source("RPM", "1000"), measurements: parseSourceMeasurements("Time,Boost Pressure (psi),Engine Speed (RPM),IAT (F),HPFP Act.[psig]\n0,1,1000,86,2000")};
  const status = analysisChannelStatus(s, unavailable);
  assert.equal(s.measurements.sourceFormat, "bm3");
  for (const key of ["rpm","iat","rail_pressure"]) assert.equal(status.channels.find(c=>c.key===key)?.samples.state,"available");
  assert.equal(s.measurements.channels.find(c=>c.key==="iat")?.values[0],30);
});
test("unknown casing and units remain source headers, never fuzzy aliases or absent claims", () => {
  const s=source("rPm,IAT (K),HPFP Pressure (bar)", "1000,300,100");
  const status=analysisChannelStatus(s, unavailable);
  assert.deepEqual(status.unassignedHeaders, ["rPm","IAT (K)","HPFP Pressure (bar)"]);
  for(const key of ["rpm","iat","rail_pressure"]) {
    const c=status.channels.find(c=>c.key===key)!;
    assert.equal(c.raw,"unresolved"); assert.equal(c.alias,"unqualified");
    assert.equal(c.samples.count,0); assert.doesNotMatch(c.telemetryMessage,/Not present/);
  }
});
test("absent, empty and ambiguous columns are distinct", () => {
  const missing=analysisChannelStatus(source("RPM","1000"),unavailable).channels.find(c=>c.key==="iat")!;
  assert.equal(missing.telemetryMessage,"Not present in the selected log.");
  const empty=analysisChannelStatus(source("RPM,IAT (*C)","1000,"),unavailable).channels.find(c=>c.key==="iat")!;
  assert.equal(empty.raw,"present"); assert.equal(empty.alias,"qualified"); assert.match(empty.telemetryMessage,/no finite observations/);
  const ambiguous=analysisChannelStatus(source("RPM,IAT (*C),IAT (F)","1000,30,86"),unavailable).channels.find(c=>c.key==="iat")!;
  assert.equal(ambiguous.raw,"present"); assert.equal(ambiguous.alias,"ambiguous"); assert.equal(ambiguous.samples.count,0);
});
test("exact binding, inspection suggestion, neutral event and diagnostic relationship remain independent", () => {
  const s=source("RPM,IAT (*C),Rail pressure (PSI)","1000,30,2000");
  const relation={channel:"rail_pressure",title:"Exact test table",occurrence:0,revision:"r",key:"k",meaning:"test",assertion:"a",provenance:[],limitations:[],grade:"Exact Definition telemetry relationship"};
  const resolution={...unavailable,relationships:[relation]};
  const c=analysisChannelStatus(s,resolution,["rail_pressure"]).channels.find(c=>c.key==="rail_pressure")!;
  assert.equal(c.bindings.length,1); assert.equal(c.diagnosticRelationship,"available"); assert(c.eventUsage.length);
  const suggested=analysisChannelStatus(s,{...resolution,relationships:[{...relation,grade:"Suggested inspection target — qualified system membership"}]}).channels.find(c=>c.key==="rail_pressure")!;
  assert.equal(suggested.bindings.length,0); assert.equal(suggested.inspectionRelationships.length,1);
  assert.equal(suggested.samples.count,c.samples.count);
});
test("unavailable source cannot leak retained channel metadata or samples", () => {
  const s=source("RPM","1000");
  assert.equal(analysisChannelStatus({...s,state:"missing"},unavailable).channels.length,0);
});
