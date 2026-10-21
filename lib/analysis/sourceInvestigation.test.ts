import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {parseSourceMeasurements} from "./analysisCapabilities.ts";
import {sourceInvestigation} from "./sourceInvestigation.ts";
import {tuneEvidenceContext, type OwnerTuneDeclaration} from "./analysisTuneEvidence.ts";
import type {AnalysisSource} from "./analysisSource";

const source = (pedal = "100", rpm = "4000"): AnalysisSource => ({state: "available", digest: "fixture", finding: "fixture",
  measurements: parseSourceMeasurements(`Time,RPM,Boost Mean PSI,Boost target (PSI),Accel. Pedal[%],Rail pressure (PSI),IAT (*C),Cyl1 Timing Cor (*),Cyl2 Timing Cor (*)\n10,2000,5,4,${pedal},3000,40,0,0\n11,3000,7,5,${pedal},2800,41,-1,-3\n13,${rpm},8,5,${pedal},2900,42,-2,-3`)});
const census = JSON.parse(fs.readFileSync(new URL("../../engineering/calibration/bmw-master-99-xdf-census.json", import.meta.url), "utf8")) as {rows: {family: string}[]};
for (const family of [...new Set(census.rows.map(r => r.family)), "N20 binary-only", "future qualified translator"]) test(`${family}: complete investigation needs no active modified BIN or platform fault rule`, () => {
  const input = source(), before = JSON.stringify(input), result = sourceInvestigation(input);
  assert.equal(result.pullState, "observed");
  assert.equal(result.windows.length, 1);
  assert.deepEqual([result.windows[0].startSeconds,result.windows[0].endSeconds], [0,3]);
  assert(result.candidates.length > 0);
  assert(result.candidates.every(c => c.note && c.alternatives.length && c.rejectedClaims.length));
  assert(result.candidates.some(c => c.loadedWindows.length));
  assert.doesNotMatch(JSON.stringify(result), /N54|B58|fault detected|"confidence"/);
  assert.equal(JSON.stringify(input), before);
});
test("no high-demand pull describes the actual operating region without suppressing events", () => {
  const result = sourceInvestigation(source("20"));
  assert.equal(result.pullState, "not_observed"); assert.equal(result.windows.length, 0);
  assert.match(result.operatingRegion, /2000–4000 rpm/); assert(result.candidates.length);
  assert(result.candidates.every(c => !c.loadedWindows.length));
});
test("falling RPM is not a loaded acceleration window", () => {
  assert.equal(sourceInvestigation(source("100", "1500")).pullState, "not_observed");
});
test("missing pedal is not silently replaced with throttle; missing source fails closed", () => {
  const input = source(); input.measurements!.channels = input.measurements!.channels.filter(c => c.key !== "accelerator_pedal");
  assert.equal(sourceInvestigation(input).pullState, "blocked");
  assert.equal(sourceInvestigation({...input,state:"missing"}).candidates.length, 0);
});
test("gaps break windows and candidates rank only within one check", () => {
  const input = source(); input.measurements!.channels.find(c => c.key === "rpm")!.values[1] = null;
  const result = sourceInvestigation(input); assert.equal(result.windows.length, 0);
  for (const kind of new Set(result.candidates.map(c => c.event.kind))) {
    const group = result.candidates.filter(c => c.event.kind === kind);
    assert.deepEqual(group.map(c => c.rankWithinCheck), group.map((_,i)=>i+1));
    assert(group.every((c,i)=>!i || group[i-1].event.value >= c.event.value));
  }
});
test("stock reference bytes plus an owner OTS declaration never become active modified evidence", () => {
  const declaration: OwnerTuneDeclaration = {provider:"MHD",tuneType:"OTS",stage:"Stage 2+",fuel:null,flashOptions:null,declaredAt:"2026-10-21T04:00:00Z",evidenceGrade:"owner-declared, not byte-verified"};
  const result = tuneEvidenceContext({sourceId:"owned",fileName:"Stage2.bin",digest:"abc",byteLength:100,referenceId:"stock",referenceDigest:"abc",matchesOwnedStockReference:true},declaration);
  assert.equal(result.activeModifiedComparison,"unavailable");
  assert.match(result.sourceClassification,/OEM authenticity.*not established/);
  assert.equal(result.declaration,declaration);
  assert.match(result.inspection,/independently of active modified bytes/);
  assert.equal(tuneEvidenceContext(null,null).declaration,null);
});
test("context candidates cite actual transitions without diagnosing shifts or component faults", () => {
  const input=source();
  input.measurements!.channels.find(c=>c.key==="rpm")!.values[2]=2500;
  const result=sourceInvestigation(input);
  const candidate=result.candidates.find(c=>c.contextCandidate);
  assert(candidate); assert(candidate.contextCandidate!.evidence.some(e=>e.includes("rpm decreased from 3000 to 2500")));
  assert.match(candidate.contextCandidate!.conclusion,/does not prove.*cause.*gear change/);
  assert(candidate.alternatives.every(a=>a.state==="open"));
});
